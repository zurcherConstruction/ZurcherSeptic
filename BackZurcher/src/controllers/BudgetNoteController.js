const { BudgetNote, Budget, Staff, Notification, sequelize } = require('../data');
const { Op } = require('sequelize');
const { sendNotifications } = require('../utils/notifications/notificationManager');

// 🔧 Helper: Extraer menciones @usuario del mensaje
const extractMentions = (message) => {
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  while ((match = mentionRegex.exec(message)) !== null) {
    mentions.push(match[1]); // match[1] es el nombre después de @
  }
  return mentions;
};

// 🔧 Helper: Encontrar IDs de staff por nombres mencionados
const findStaffByNames = async (names) => {
  if (!names || names.length === 0) return [];
  
  const staff = await Staff.findAll({
    where: {
      [Op.or]: names.map(name => ({
        name: {
          [Op.iLike]: `%${name}%` // Búsqueda case-insensitive individual
        }
      })),
      isActive: true
    },
    attributes: ['id', 'name']
  });
  
  return staff;
};

const BudgetNoteController = {
  
  // 📝 Crear una nueva nota de seguimiento
  async createNote(req, res) {
    try {
      const { budgetId, message, noteType, priority, relatedStatus } = req.body;
      const staffId = req.user?.id; // ID del usuario autenticado

      // Validaciones
      if (!budgetId || !message) {
        return res.status(400).json({ 
          error: 'budgetId y message son requeridos' 
        });
      }

      if (!staffId) {
        return res.status(401).json({ 
          error: 'Usuario no autenticado' 
        });
      }

      // Verificar que el budget existe
      const budget = await Budget.findByPk(budgetId);
      if (!budget) {
        return res.status(404).json({ 
          error: 'Presupuesto no encontrado' 
        });
      }

      // 👥 Detectar menciones en el mensaje
      const mentionedNames = extractMentions(message);
      const mentionedStaff = await findStaffByNames(mentionedNames);
      const mentionedStaffIds = mentionedStaff.map(s => s.id);

      // Crear la nota
      const note = await BudgetNote.create({
        budgetId,
        staffId,
        message: message.trim(),
        noteType: noteType || 'follow_up',
        priority: priority || 'medium',
        relatedStatus: relatedStatus || budget.status,
        isResolved: false,
        mentionedStaffIds // Guardar IDs de mencionados
      });

      // 🔔 Crear notificaciones para usuarios mencionados
      if (mentionedStaffIds.length > 0) {
        const author = await Staff.findByPk(staffId, { attributes: ['name', 'email'] });
        const notificationPromises = mentionedStaffIds.map(mentionedId => {
          // No notificar al autor si se menciona a sí mismo
          if (mentionedId === staffId) return null;
          
          return Notification.create({
            staffId: mentionedId,
            senderId: staffId, // 👤 ID del autor que menciona (relación correcta)
            type: 'mention',
            title: `${author?.name || 'Alguien'} te mencionó en un seguimiento`,
            message: `📍 ${budget.propertyAddress || `Presupuesto #${budgetId}`}: ${message.substring(0, 80)}${message.length > 80 ? '...' : ''}`,
            relatedId: budgetId,
            relatedType: 'budget_note',
            isRead: false
          });
        });

        await Promise.all(notificationPromises.filter(p => p !== null));
        
        // 📧 Enviar emails a los mencionados
        try {
          await sendNotifications('mentionInNote', {
            mentionedStaffIds,
            authorName: author?.name || 'Un usuario',
            location: budget.propertyAddress || `Presupuesto #${budgetId}`,
            notePreview: message.substring(0, 200),
            noteType: 'budget_note',
            budgetId
          }, null, null, { userId: staffId }); // ✅ Pasar userId para filtro de auto-notificación
        } catch (emailError) {
          console.error('Error enviando emails de mención:', emailError);
          // No fallar la creación de la nota si falla el email
        }
      }

      // Cargar la nota con el autor para devolverla completa
      const noteWithAuthor = await BudgetNote.findByPk(note.id, {
        include: [
          {
            model: Staff,
            as: 'author',
            attributes: ['id', 'name', 'email']
          }
        ]
      });

      res.status(201).json({
        message: 'Nota de seguimiento creada exitosamente',
        note: noteWithAuthor
      });

    } catch (error) {
      console.error('Error al crear nota de seguimiento:', error);
      res.status(500).json({ 
        error: 'Error al crear la nota de seguimiento',
        details: error.message 
      });
    }
  },

  // 📋 Obtener todas las notas de un budget
  async getNotesByBudget(req, res) {
    try {
      const { budgetId } = req.params;
      const { noteType, priority, unresolved } = req.query;

      // Construir filtros
      const whereClause = { budgetId };
      
      if (noteType && noteType !== 'all') {
        whereClause.noteType = noteType;
      }
      
      if (priority && priority !== 'all') {
        whereClause.priority = priority;
      }
      
      if (unresolved === 'true') {
        whereClause.isResolved = false;
      }

      const notes = await BudgetNote.findAll({
        where: whereClause,
        include: [
          {
            model: Staff,
            as: 'author',
            attributes: ['id', 'name', 'email']
          },
          {
            model: Budget,
            as: 'budget', // 🔧 Agregar alias correcto
            attributes: ['idBudget', 'propertyAddress']
          }
        ],
        order: [['createdAt', 'DESC']] // Más recientes primero
      });

      res.status(200).json({
        count: notes.length,
        notes
      });

    } catch (error) {
      console.error('Error al obtener notas:', error);
      res.status(500).json({ 
        error: 'Error al obtener las notas',
        details: error.message 
      });
    }
  },

  // 🔍 Obtener una nota específica
  async getNoteById(req, res) {
    try {
      const { noteId } = req.params;

      const note = await BudgetNote.findByPk(noteId, {
        include: [
          {
            model: Staff,
            as: 'author',
            attributes: ['id', 'name', 'email']
          },
          {
            model: Budget,
            as: 'budget',
            attributes: ['idBudget', 'applicantName', 'propertyAddress', 'status']
          }
        ]
      });

      if (!note) {
        return res.status(404).json({ 
          error: 'Nota no encontrada' 
        });
      }

      res.status(200).json(note);

    } catch (error) {
      console.error('Error al obtener nota:', error);
      res.status(500).json({ 
        error: 'Error al obtener la nota',
        details: error.message 
      });
    }
  },

  // ✏️ Actualizar una nota (solo el autor o admin)
  async updateNote(req, res) {
    try {
      const { noteId } = req.params;
      const { message, noteType, priority, isResolved } = req.body;
      const staffId = req.user?.id;

      const note = await BudgetNote.findByPk(noteId);

      if (!note) {
        return res.status(404).json({ 
          error: 'Nota no encontrada' 
        });
      }

      // Verificar que el usuario es el autor o admin
      const isAdmin = req.user?.role === 'admin';
      const isAuthor = note.staffId === staffId;

      if (!isAdmin && !isAuthor) {
        return res.status(403).json({ 
          error: 'No tienes permiso para editar esta nota' 
        });
      }

      // Actualizar campos permitidos
      const updates = {};
      if (message !== undefined) updates.message = message.trim();
      if (noteType !== undefined) updates.noteType = noteType;
      if (priority !== undefined) updates.priority = priority;
      if (isResolved !== undefined) updates.isResolved = isResolved;

      await note.update(updates);

      // Recargar con autor
      const updatedNote = await BudgetNote.findByPk(noteId, {
        include: [
          {
            model: Staff,
            as: 'author',
            attributes: ['id', 'name', 'email']
          }
        ]
      });

      res.status(200).json({
        message: 'Nota actualizada exitosamente',
        note: updatedNote
      });

    } catch (error) {
      console.error('Error al actualizar nota:', error);
      res.status(500).json({ 
        error: 'Error al actualizar la nota',
        details: error.message 
      });
    }
  },

  // 🗑️ Eliminar una nota (solo el autor o admin)
  async deleteNote(req, res) {
    try {
      const { noteId } = req.params;
      const staffId = req.user?.id;

      const note = await BudgetNote.findByPk(noteId);

      if (!note) {
        return res.status(404).json({ 
          error: 'Nota no encontrada' 
        });
      }

      // Verificar que el usuario es el autor o admin
      const isAdmin = req.user?.role === 'admin';
      const isAuthor = note.staffId === staffId;

      if (!isAdmin && !isAuthor) {
        return res.status(403).json({ 
          error: 'No tienes permiso para eliminar esta nota' 
        });
      }

      await note.destroy();

      res.status(200).json({
        message: 'Nota eliminada exitosamente'
      });

    } catch (error) {
      console.error('Error al eliminar nota:', error);
      res.status(500).json({ 
        error: 'Error al eliminar la nota',
        details: error.message 
      });
    }
  },

  // 📊 Obtener estadísticas de seguimiento
  async getFollowUpStats(req, res) {
    try {
      const { budgetId } = req.params;

      const stats = await BudgetNote.findAll({
        where: { budgetId },
        attributes: [
          'noteType',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['noteType']
      });

      // Última nota
      const lastNote = await BudgetNote.findOne({
        where: { budgetId },
        order: [['createdAt', 'DESC']],
        attributes: ['createdAt', 'noteType', 'message'],
        include: [
          {
            model: Staff,
            as: 'author',
            attributes: ['name']
          }
        ]
      });

      // Problemas sin resolver
      const unresolvedProblems = await BudgetNote.count({
        where: {
          budgetId,
          noteType: 'problem',
          isResolved: false
        }
      });

      res.status(200).json({
        stats,
        lastNote,
        unresolvedProblems,
        totalNotes: await BudgetNote.count({ where: { budgetId } })
      });

    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({ 
        error: 'Error al obtener estadísticas',
        details: error.message 
      });
    }
  },

  // 👥 Obtener lista de staff activo para menciones
  async getActiveStaff(req, res) {
    try {
      const staff = await Staff.findAll({
        where: { isActive: true },
        attributes: ['id', 'name', 'email', 'role'],
        order: [['name', 'ASC']]
      });

      res.status(200).json(staff);

    } catch (error) {
      console.error('Error al obtener staff activo:', error);
      res.status(500).json({ 
        error: 'Error al obtener lista de staff',
        details: error.message 
      });
    }
  },

  // 🔔 ===== SISTEMA DE ALERTAS =====

  // Marcar nota como leída por el usuario actual
  async markAsRead(req, res) {
    try {
      const { noteId } = req.params;
      const staffId = req.user?.id;

      if (!staffId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const note = await BudgetNote.findByPk(noteId);
      if (!note) {
        return res.status(404).json({ error: 'Nota no encontrada' });
      }

      // Agregar staffId al array readBy si no está ya
      let readBy = note.readBy || [];
      if (!readBy.includes(staffId)) {
        readBy = [...readBy, staffId]; // Crear nuevo array para que Sequelize detecte el cambio
        await note.update({
          readBy,
          isRead: true // Marcar como leída
        });
      }

      // Recargar la nota para obtener los valores actualizados
      await note.reload();

      res.status(200).json({
        success: true,
        data: {
          message: 'Nota marcada como leída',
          note
        }
      });

    } catch (error) {
      console.error('Error al marcar nota como leída:', error);
      res.status(500).json({ 
        error: 'Error al marcar nota como leída',
        details: error.message 
      });
    }
  },

  // Marcar múltiples notas como leídas (bulk)
  async markMultipleAsRead(req, res) {
    try {
      const { noteIds } = req.body; // Array de IDs
      const staffId = req.user?.id;

      if (!staffId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      if (!Array.isArray(noteIds) || noteIds.length === 0) {
        return res.status(400).json({ error: 'noteIds debe ser un array no vacío' });
      }

      // Actualizar todas las notas
      const notes = await BudgetNote.findAll({
        where: { id: noteIds }
      });

      const updates = notes.map(note => {
        const readBy = note.readBy || [];
        if (!readBy.includes(staffId)) {
          const newReadBy = [...readBy, staffId]; // Crear nuevo array
          return note.update({ readBy: newReadBy, isRead: true });
        }
        return Promise.resolve();
      });

      await Promise.all(updates);

      res.status(200).json({
        message: `${noteIds.length} notas marcadas como leídas`
      });

    } catch (error) {
      console.error('Error al marcar múltiples notas:', error);
      res.status(500).json({ 
        error: 'Error al marcar notas como leídas',
        details: error.message 
      });
    }
  },

  // Obtener notas no leídas para el usuario actual
  async getUnreadNotes(req, res) {
    try {
      const staffId = req.user?.id;

      if (!staffId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      // Buscar notas donde el usuario NO esté en readBy
      const notes = await BudgetNote.findAll({
        where: {
          [Op.or]: [
            { readBy: { [Op.not]: { [Op.contains]: [staffId] } } },
            { readBy: null },
            { readBy: [] }
          ],
          staffId: { [Op.ne]: staffId } // Excluir notas propias
        },
        include: [
          {
            model: Staff,
            as: 'author',
            attributes: ['id', 'name']
          },
          {
            model: Budget,
            as: 'budget',
            attributes: ['idBudget', 'propertyAddress', 'applicantName']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      res.status(200).json({
        count: notes.length,
        notes
      });

    } catch (error) {
      console.error('Error al obtener notas no leídas:', error);
      res.status(500).json({ 
        error: 'Error al obtener notas no leídas',
        details: error.message 
      });
    }
  },

  // ⏰ ===== SISTEMA DE RECORDATORIOS =====

  // Crear o actualizar recordatorio en una nota
  async setReminder(req, res) {
    try {
      const { noteId } = req.params;
      const { reminderDate, reminderFor } = req.body; // reminderFor es array de staffIds
      const staffId = req.user?.id;

      if (!staffId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      if (!reminderDate) {
        return res.status(400).json({ error: 'reminderDate es requerido' });
      }

      const note = await BudgetNote.findByPk(noteId);
      if (!note) {
        return res.status(404).json({ error: 'Nota no encontrada' });
      }

      // Validar que la fecha sea futura
      const reminderDateObj = new Date(reminderDate);
      if (reminderDateObj <= new Date()) {
        return res.status(400).json({ 
          error: 'La fecha del recordatorio debe ser futura' 
        });
      }

      // Si no se especifica reminderFor, usar el usuario actual
      const finalReminderFor = reminderFor && reminderFor.length > 0 
        ? reminderFor 
        : [staffId];

      await note.update({
        reminderDate: reminderDateObj,
        reminderFor: finalReminderFor,
        isReminderActive: true,
        reminderCompletedAt: null // Reset si se reactiva
      });

      // 🔔 Crear notificaciones para los usuarios asignados
      const author = await Staff.findByPk(staffId, { attributes: ['name'] });
      const budget = await Budget.findByPk(note.budgetId, { 
        attributes: ['propertyAddress', 'applicantName'] 
      });

      const notificationPromises = finalReminderFor.map(targetStaffId => {
        return Notification.create({
          staffId: targetStaffId,
          senderId: staffId,
          type: 'reminder',
          title: '⏰ Nuevo recordatorio',
          message: `${author?.name || 'Alguien'} creó un recordatorio para ${reminderDateObj.toLocaleDateString()} sobre: ${budget?.propertyAddress || `Budget #${note.budgetId}`}`,
          relatedId: note.budgetId,
          relatedType: 'budget_reminder',
          isRead: false
        });
      });

      await Promise.all(notificationPromises);

      const updatedNote = await BudgetNote.findByPk(noteId, {
        include: [
          {
            model: Staff,
            as: 'author',
            attributes: ['id', 'name']
          }
        ]
      });

      res.status(200).json({
        message: 'Recordatorio configurado exitosamente',
        note: updatedNote
      });

    } catch (error) {
      console.error('Error al configurar recordatorio:', error);
      res.status(500).json({ 
        error: 'Error al configurar recordatorio',
        details: error.message 
      });
    }
  },

  // Completar/cancelar un recordatorio
  async completeReminder(req, res) {
    try {
      const { noteId } = req.params;
      const staffId = req.user?.id;

      if (!staffId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const note = await BudgetNote.findByPk(noteId);
      if (!note) {
        return res.status(404).json({ error: 'Nota no encontrada' });
      }

      if (!note.isReminderActive) {
        return res.status(400).json({ 
          error: 'Esta nota no tiene un recordatorio activo' 
        });
      }

      await note.update({
        isReminderActive: false,
        reminderCompletedAt: new Date()
      });

      res.status(200).json({
        message: 'Recordatorio completado',
        note
      });

    } catch (error) {
      console.error('Error al completar recordatorio:', error);
      res.status(500).json({ 
        error: 'Error al completar recordatorio',
        details: error.message 
      });
    }
  },

  // Obtener recordatorios activos del usuario
  async getActiveReminders(req, res) {
    try {
      const staffId = req.user?.id;

      if (!staffId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const now = new Date();

      // Buscar notas con recordatorios activos para este usuario
      const reminders = await BudgetNote.findAll({
        where: {
          isReminderActive: true,
          reminderFor: { [Op.contains]: [staffId] }
        },
        include: [
          {
            model: Staff,
            as: 'author',
            attributes: ['id', 'name']
          },
          {
            model: Budget,
            as: 'budget',
            attributes: ['idBudget', 'propertyAddress', 'applicantName', 'status']
          }
        ],
        order: [['reminderDate', 'ASC']]
      });

      // Separar en vencidos y futuros
      const overdue = reminders.filter(r => new Date(r.reminderDate) <= now);
      const upcoming = reminders.filter(r => new Date(r.reminderDate) > now);

      res.status(200).json({
        total: reminders.length,
        overdue: {
          count: overdue.length,
          reminders: overdue
        },
        upcoming: {
          count: upcoming.length,
          reminders: upcoming
        }
      });

    } catch (error) {
      console.error('Error al obtener recordatorios:', error);
      res.status(500).json({ 
        error: 'Error al obtener recordatorios',
        details: error.message 
      });
    }
  },

  // 🔔 Obtener contador de alertas (notas no leídas + recordatorios vencidos)
  async getAlertCount(req, res) {
    try {
      const staffId = req.user?.id;

      if (!staffId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const now = new Date();

      // Contar notas no leídas (excluyendo propias)
      const unreadCount = await BudgetNote.count({
        where: {
          [Op.or]: [
            { readBy: { [Op.not]: { [Op.contains]: [staffId] } } },
            { readBy: null },
            { readBy: [] }
          ],
          staffId: { [Op.ne]: staffId }
        }
      });

      // Contar recordatorios vencidos
      const overdueRemindersCount = await BudgetNote.count({
        where: {
          isReminderActive: true,
          reminderFor: { [Op.contains]: [staffId] },
          reminderDate: { [Op.lte]: now }
        }
      });

      // Contar recordatorios futuros (próximos 7 días)
      const upcomingDate = new Date();
      upcomingDate.setDate(upcomingDate.getDate() + 7);

      const upcomingRemindersCount = await BudgetNote.count({
        where: {
          isReminderActive: true,
          reminderFor: { [Op.contains]: [staffId] },
          reminderDate: { 
            [Op.gt]: now,
            [Op.lte]: upcomingDate
          }
        }
      });

      res.status(200).json({
        unreadNotes: unreadCount,
        overdueReminders: overdueRemindersCount,
        upcomingReminders: upcomingRemindersCount,
        totalAlerts: unreadCount + overdueRemindersCount
      });

    } catch (error) {
      console.error('Error al obtener contador de alertas:', error);
      res.status(500).json({ 
        error: 'Error al obtener contador de alertas',
        details: error.message 
      });
    }
  },

  // 🆕 Obtener lista de budgets con alertas (eficiente - solo IDs y contadores)
  async getBudgetsWithAlerts(req, res) {
    try {
      const staffId = req.user?.id;

      if (!staffId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const now = new Date();
      const upcomingDate = new Date();
      upcomingDate.setDate(upcomingDate.getDate() + 7);

      // Consulta SQL directa para obtener budgets con alertas
      const query = `
        SELECT 
          "budgetId",
          COUNT(CASE 
            WHEN "staffId" != :staffId 
            AND (
              "readBy" IS NULL 
              OR array_length("readBy", 1) IS NULL 
              OR NOT (:staffId::uuid = ANY("readBy"))
            )
            THEN 1 
          END) as "unreadCount",
          COUNT(CASE 
            WHEN "isReminderActive" = true 
            AND :staffId::uuid = ANY("reminderFor") 
            AND "reminderDate" <= :now
            THEN 1 
          END) as "overdueRemindersCount",
          COUNT(CASE 
            WHEN "isReminderActive" = true 
            AND :staffId::uuid = ANY("reminderFor") 
            AND "reminderDate" > :now 
            AND "reminderDate" <= :upcomingDate
            THEN 1 
          END) as "upcomingRemindersCount"
        FROM "BudgetNotes"
        GROUP BY "budgetId"
        HAVING 
          COUNT(CASE WHEN "staffId" != :staffId AND ("readBy" IS NULL OR array_length("readBy", 1) IS NULL OR NOT (:staffId::uuid = ANY("readBy"))) THEN 1 END) > 0
          OR COUNT(CASE WHEN "isReminderActive" = true AND :staffId::uuid = ANY("reminderFor") AND "reminderDate" <= :now THEN 1 END) > 0
          OR COUNT(CASE WHEN "isReminderActive" = true AND :staffId::uuid = ANY("reminderFor") AND "reminderDate" > :now AND "reminderDate" <= :upcomingDate THEN 1 END) > 0
      `;

      const budgetsWithAlerts = await sequelize.query(query, {
        replacements: { 
          staffId,
          now: now.toISOString(),
          upcomingDate: upcomingDate.toISOString()
        },
        type: sequelize.QueryTypes.SELECT
      });

      // Formatear respuesta como mapa: { budgetId: { unread, overdue, upcoming, total } }
      const alertsMap = {};
      budgetsWithAlerts.forEach(item => {
        const unread = parseInt(item.unreadCount) || 0;
        const overdue = parseInt(item.overdueRemindersCount) || 0;
        const upcoming = parseInt(item.upcomingRemindersCount) || 0;
        
        alertsMap[item.budgetId] = {
          unread,
          overdue,
          upcoming,
          total: unread + overdue,
          hasOverdue: overdue > 0,
          hasUnread: unread > 0,
          hasUpcoming: upcoming > 0
        };
      });

      res.status(200).json({
        budgetsWithAlerts: alertsMap,
        totalBudgetsWithAlerts: Object.keys(alertsMap).length
      });

    } catch (error) {
      console.error('Error al obtener budgets con alertas:', error);
      res.status(500).json({ 
        error: 'Error al obtener budgets con alertas',
        details: error.message 
      });
    }
  }
};

module.exports = BudgetNoteController;
