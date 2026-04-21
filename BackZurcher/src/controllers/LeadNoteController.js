const { LeadNote, SalesLead, Staff, sequelize } = require('../data');
const { Op } = require('sequelize');
const { sendNotifications } = require('../utils/notifications/notificationManager');

// 🔧 Helper: Extraer menciones @usuario del mensaje
const extractMentions = (message) => {
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  while ((match = mentionRegex.exec(message)) !== null) {
    mentions.push(match[1]);
  }
  return mentions;
};

// 🔧 Helper: Encontrar staff por nombres mencionados
const findStaffByNames = async (names) => {
  if (!names || names.length === 0) return [];
  return Staff.findAll({
    where: {
      [Op.or]: names.map(name => ({ name: { [Op.iLike]: `%${name}%` } })),
      isActive: true
    },
    attributes: ['id', 'name']
  });
};

const LeadNoteController = {
  
  // 📝 Crear una nueva nota para un lead
  async createNote(req, res) {
    try {
      const {
        leadId,
        message,
        noteType,
        priority,
        relatedStatus,
        reminderDate,
        reminderFor,
        isReminderActive
      } = req.body;
      
      const staffId = req.user?.id;

      // Validaciones
      if (!leadId || !message) {
        return res.status(400).json({ 
          error: 'leadId y message son requeridos' 
        });
      }

      if (!staffId) {
        return res.status(401).json({ 
          error: 'Usuario no autenticado' 
        });
      }

      // 👥 Extraer menciones (sync) y buscar lead + staff en paralelo
      const mentionedNames = extractMentions(message);
      const [lead, mentionedStaff] = await Promise.all([
        SalesLead.findByPk(leadId),
        findStaffByNames(mentionedNames)
      ]);

      if (!lead) {
        return res.status(404).json({ 
          error: 'Lead no encontrado' 
        });
      }

      const mentionedStaffIds = mentionedStaff.map(s => s.id);

      // Crear la nota
      const note = await LeadNote.create({
        leadId,
        staffId,
        message: message.trim(),
        noteType: noteType || 'follow_up',
        priority: priority || 'medium',
        relatedStatus: relatedStatus || lead.status,
        isResolved: false,
        reminderDate: reminderDate || null,
        reminderFor: reminderFor || [],
        isReminderActive: isReminderActive || false
      });

      // Cargar nota con autor + actualizar lastActivityDate en paralelo
      const [noteWithAuthor] = await Promise.all([
        LeadNote.findByPk(note.id, {
          include: [{ model: Staff, as: 'author', attributes: ['id', 'name', 'email'] }]
        }),
        lead.update({ lastActivityDate: new Date() })
      ]);

      // 🔔 Enviar emails a mencionados (fire-and-forget — no bloquea la respuesta)
      if (mentionedStaffIds.length > 0) {
        const location = lead.propertyAddress || lead.applicantName || `Lead #${leadId}`;
        Staff.findByPk(staffId, { attributes: ['name', 'email'] }).then(author => {
          return sendNotifications('mentionInNote', {
            mentionedStaffIds,
            authorName: author?.name || 'Un usuario',
            location,
            notePreview: message.substring(0, 200),
            noteType: 'lead_note',
            leadId
          }, null, null, { userId: staffId }); // ✅ Pasar userId para filtro de auto-notificación
        }).catch(emailError => {
          console.error('❌ [LeadNote] Error enviando emails de mención:', emailError);
        });
      }

      res.status(201).json({
        message: 'Nota creada exitosamente',
        note: noteWithAuthor
      });

    } catch (error) {
      console.error('Error al crear nota:', error);
      res.status(500).json({ 
        error: 'Error al crear la nota',
        details: error.message 
      });
    }
  },

  // 📋 Obtener todas las notas de un lead
  async getNotesByLead(req, res) {
    try {
      const { leadId } = req.params;
      const { noteType, priority, unresolved } = req.query;

      // Construir filtros
      const whereClause = { leadId };

      if (noteType && noteType !== 'all') {
        whereClause.noteType = noteType;
      }

      if (priority && priority !== 'all') {
        whereClause.priority = priority;
      }

      if (unresolved === 'true') {
        whereClause.isResolved = false;
      }

      const notes = await LeadNote.findAll({
        where: whereClause,
        include: [
          {
            model: Staff,
            as: 'author',
            attributes: ['id', 'name', 'email']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      res.json({ notes });

    } catch (error) {
      console.error('Error al obtener notas:', error);
      res.status(500).json({ 
        error: 'Error al obtener las notas',
        details: error.message 
      });
    }
  },

  // ✏️ Actualizar una nota
  async updateNote(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const note = await LeadNote.findByPk(id);
      
      if (!note) {
        return res.status(404).json({ 
          error: 'Nota no encontrada' 
        });
      }

      await note.update(updates);

      // Recargar con autor
      const updatedNote = await LeadNote.findByPk(id, {
        include: [
          {
            model: Staff,
            as: 'author',
            attributes: ['id', 'name', 'email']
          }
        ]
      });

      res.json({
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

  // 🗑️ Eliminar una nota
  async deleteNote(req, res) {
    try {
      const { id } = req.params;

      const note = await LeadNote.findByPk(id);
      
      if (!note) {
        return res.status(404).json({ 
          error: 'Nota no encontrada' 
        });
      }

      await note.destroy();

      res.json({
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

  // ✅ Marcar nota como leída
  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const staffId = req.user?.id;

      const note = await LeadNote.findByPk(id);
      
      if (!note) {
        return res.status(404).json({ error: 'Nota no encontrada' });
      }

      // Crear nuevo array (no mutar el existente — Sequelize no detecta cambios si la referencia es la misma)
      const currentReadBy = note.readBy || [];
      if (currentReadBy.includes(staffId)) {
        return res.json({ message: 'Ya marcada como leída', note });
      }
      const readBy = [...currentReadBy, staffId];

      // Si el usuario es uno de los asignados al recordatorio, marcarlo como completado
      const reminderFor = note.reminderFor || [];
      const isReminderFor = reminderFor.includes(staffId);
      const allHaveRead = reminderFor.length > 0 && reminderFor.every(id => readBy.includes(id));

      await note.update({ 
        readBy,
        isRead: allHaveRead,
        ...(isReminderFor && { isReminderActive: false })
      });

      // Recargar desde DB para asegurar que la respuesta tiene los datos actualizados
      const updatedNote = await LeadNote.findByPk(id);
      res.json({ message: 'Nota marcada como le\u00edda', note: updatedNote });

    } catch (error) {
      console.error('Error al marcar nota como leída:', error);
      res.status(500).json({ error: 'Error al marcar la nota', details: error.message });
    }
  },

  // 🔔 Obtener leads con alertas (notas no leídas o recordatorios próximos)
  async getLeadsWithAlerts(req, res) {
    try {
      const staffId = req.user?.id;
      const { days = 7 } = req.query;

      const now = new Date();
      const upcomingDate = new Date();
      upcomingDate.setDate(upcomingDate.getDate() + parseInt(days));

      // Validar formato UUID para uso seguro en raw SQL
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!staffId || !uuidRegex.test(staffId)) {
        return res.status(400).json({ error: 'Usuario inválido' });
      }

      // Las 3 queries en paralelo para reducir tiempo de respuesta
      const [unreadNotes, overdueReminders, upcomingReminders] = await Promise.all([
        // 1. Notas no leídas por el usuario actual (staffId validado como UUID — seguro en literal)
        LeadNote.findAll({
          where: sequelize.literal(
            `NOT ("read_by" @> ARRAY['${staffId}']::uuid[])`
          ),
          attributes: ['leadId']
        }),
        // 2. Recordatorios vencidos
        LeadNote.findAll({
          where: {
            isReminderActive: true,
            reminderDate: { [Op.lt]: now },
            reminderFor: { [Op.contains]: [staffId] }
          },
          attributes: ['leadId']
        }),
        // 3. Recordatorios próximos
        LeadNote.findAll({
          where: {
            isReminderActive: true,
            reminderDate: { [Op.between]: [now, upcomingDate] },
            reminderFor: { [Op.contains]: [staffId] }
          },
          attributes: ['leadId']
        })
      ]);

      // Agrupar por leadId
      const alertMap = {};

      const addToMap = (leadId, type) => {
        if (!alertMap[leadId]) {
          alertMap[leadId] = { leadId, unread: 0, overdue: 0, upcoming: 0 };
        }
        alertMap[leadId][type]++;
      };

      unreadNotes.forEach(n => addToMap(n.leadId, 'unread'));
      overdueReminders.forEach(n => addToMap(n.leadId, 'overdue'));
      upcomingReminders.forEach(n => addToMap(n.leadId, 'upcoming'));

      // Transformar a array con flags
      const result = Object.values(alertMap).map(a => ({
        leadId: a.leadId,
        unread: a.unread,
        overdue: a.overdue,
        upcoming: a.upcoming,
        hasUnread: a.unread > 0,
        hasOverdue: a.overdue > 0,
        hasUpcoming: a.upcoming > 0,
        total: a.unread + a.overdue + a.upcoming
      }));

      res.json(result);

    } catch (error) {
      console.error('Error al obtener leads con alertas:', error);
      res.status(500).json({ 
        error: 'Error al obtener alertas',
        details: error.message 
      });
    }
  },

  // ⏰ Obtener recordatorios próximos
  async getUpcomingReminders(req, res) {
    try {
      const staffId = req.user?.id;
      const { days = 7 } = req.query;

      const upcomingDate = new Date();
      upcomingDate.setDate(upcomingDate.getDate() + parseInt(days));

      const reminders = await LeadNote.findAll({
        where: {
          isReminderActive: true,
          reminderDate: {
            [Op.between]: [new Date(), upcomingDate]
          },
          reminderFor: {
            [Op.contains]: [staffId]
          }
        },
        include: [
          {
            model: SalesLead,
            as: 'lead',
            attributes: ['id', 'clientName', 'propertyAddress', 'status']
          },
          {
            model: Staff,
            as: 'author',
            attributes: ['id', 'name', 'email']
          }
        ],
        order: [['reminderDate', 'ASC']]
      });

      res.json({
        reminders,
        total: reminders.length
      });

    } catch (error) {
      console.error('Error al obtener recordatorios:', error);
      res.status(500).json({ 
        error: 'Error al obtener recordatorios',
        details: error.message 
      });
    }
  },

  // ✅ Completar recordatorio
  async completeReminder(req, res) {
    try {
      const { id } = req.params;

      const note = await LeadNote.findByPk(id);
      
      if (!note) {
        return res.status(404).json({ 
          error: 'Nota no encontrada' 
        });
      }

      await note.update({
        isReminderActive: false,
        reminderCompletedAt: new Date()
      });

      res.json({
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

  // 🔔 Obtener leads con recordatorios próximos (con detalles completos)
  async getLeadsWithUpcomingAlerts(req, res) {
    try {
      const { days = 7 } = req.query;

      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + parseInt(days));

      const leadsWithAlerts = await SalesLead.findAll({
        where: {
          status: { [Op.notIn]: ['archived'] }
        },
        include: [
          {
            model: LeadNote,
            as: 'leadNotes',
            required: true,
            where: {
              isReminderActive: true,
              reminderCompletedAt: null
            },
            attributes: ['id', 'message', 'noteType', 'priority', 'reminderDate', 'createdAt'],
            include: [
              {
                model: Staff,
                as: 'author',
                attributes: ['id', 'name', 'email']
              }
            ]
          }
        ],
        attributes: ['id', 'applicantName', 'propertyAddress', 'status', 'createdAt'],
        order: [[{ model: LeadNote, as: 'leadNotes' }, 'reminderDate', 'ASC']]
      });

      const result = leadsWithAlerts.map(lead => {
        const leadData = lead.toJSON();
        const nearestAlert = leadData.leadNotes[0];
        const daysRemaining = Math.ceil(
          (new Date(nearestAlert.reminderDate) - now) / (1000 * 60 * 60 * 24)
        );

        return {
          ...leadData,
          nearestAlert: {
            ...nearestAlert,
            daysRemaining,
            isOverdue: daysRemaining < 0,
            isToday: daysRemaining === 0,
            isUrgent: daysRemaining <= 1
          },
          alertCount: leadData.leadNotes.length
        };
      });

      res.status(200).json({
        success: true,
        count: result.length,
        leads: result
      });

    } catch (error) {
      console.error('Error al obtener leads con alertas próximas:', error);
      res.status(500).json({
        error: 'Error al obtener leads con alertas próximas',
        details: error.message
      });
    }
  },

  // ⏰ Crear o actualizar recordatorio en una nota
  async setReminder(req, res) {
    try {
      const { id } = req.params;
      const { reminderDate, reminderFor } = req.body;
      const staffId = req.user?.id;

      if (!staffId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      if (!reminderDate) {
        return res.status(400).json({ error: 'reminderDate es requerido' });
      }

      const note = await LeadNote.findByPk(id);
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

      res.json({
        message: 'Recordatorio configurado exitosamente',
        note
      });

    } catch (error) {
      console.error('Error al configurar recordatorio:', error);
      res.status(500).json({ 
        error: 'Error al configurar recordatorio',
        details: error.message 
      });
    }
  }
};

module.exports = LeadNoteController;
