const { Reminder, ReminderAssignment, ReminderComment, Staff, sequelize } = require('../data');
const { Op } = require('sequelize');

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };

// Atributos del staff para incluir
const STAFF_ATTRS = ['id', 'name', 'role'];

// Incluye assignments + comments + creator en una consulta
const reminderIncludes = (staffId) => [
  { model: Staff, as: 'creator', attributes: STAFF_ATTRS },
  {
    model: ReminderAssignment,
    as: 'assignments',
    include: [{ model: Staff, as: 'staff', attributes: STAFF_ATTRS }],
  },
  {
    model: ReminderComment,
    as: 'comments',
    include: [{ model: Staff, as: 'author', attributes: STAFF_ATTRS }],
    order: [['createdAt', 'ASC']],
  },
];

// Enriquecer con campo myAssignment para el staff autenticado
const enrichWithMine = (reminder, staffId) => {
  const plain = reminder.toJSON ? reminder.toJSON() : reminder;
  plain.myAssignment = plain.assignments?.find(a => a.staff_id === staffId || a.staffId === staffId) || null;
  return plain;
};

const canViewReminder = async (reminderId, staffId) => {
  const [reminder, assignment] = await Promise.all([
    Reminder.findByPk(reminderId),
    ReminderAssignment.findOne({ where: { reminderId, staffId } }),
  ]);

  if (!reminder) return { reminder: null, allowed: false };
  return { reminder, allowed: !!assignment || reminder.createdBy === staffId };
};

module.exports = {

  // GET /reminders — Recordatorios del staff autenticado (pendientes)
  async getMyReminders(req, res) {
    try {
      const staffId = req.staff.id;

      // Buscar recordatorios donde el staff tiene assignment
      const assignments = await ReminderAssignment.findAll({
        where: { staff_id: staffId },
        include: [{
          model: Reminder,
          as: 'reminder',
          include: [
            { model: Staff, as: 'creator', attributes: STAFF_ATTRS },
            { model: ReminderAssignment, as: 'assignments', include: [{ model: Staff, as: 'staff', attributes: STAFF_ATTRS }] },
            { model: ReminderComment, as: 'comments', include: [{ model: Staff, as: 'author', attributes: STAFF_ATTRS }] },
          ]
        }],
        order: [[{ model: Reminder, as: 'reminder' }, 'createdAt', 'DESC']],
      });

      const reminders = assignments.map(a => {
        const r = a.reminder.toJSON();
        r.myAssignment = { completed: a.completed, completedAt: a.completedAt, id: a.id };
        return r;
      });

      res.json({ success: true, reminders });
    } catch (err) {
      console.error('[ReminderController] getMyReminders:', err);
      res.status(500).json({ error: true, message: 'Error obteniendo recordatorios' });
    }
  },

  // GET /reminders/all — Lista general compartida (solo broadcast)
  async getAllReminders(req, res) {
    try {
      if (!['admin', 'owner'].includes(req.staff.role)) {
        return res.status(403).json({ error: true, message: 'No tienes permiso para ver todos los recordatorios' });
      }

      const reminders = await Reminder.findAll({
        where: { type: 'broadcast' },
        include: reminderIncludes(),
        order: [['createdAt', 'DESC']],
      });
      res.json({ success: true, reminders: reminders.map(r => r.toJSON()) });
    } catch (err) {
      console.error('[ReminderController] getAllReminders:', err);
      res.status(500).json({ error: true, message: 'Error obteniendo recordatorios' });
    }
  },

  // GET /reminders/:id — Detalle completo de un recordatorio
  async getReminderById(req, res) {
    try {
      const { id } = req.params;
      const staffId = req.staff.id;
      const isOwnerOrAdmin = ['admin', 'owner'].includes(req.staff.role);

      const reminder = await Reminder.findByPk(id, { include: reminderIncludes() });
      if (!reminder) return res.status(404).json({ error: true, message: 'No encontrado' });

      const r = reminder.toJSON();
      const hasAssignment = r.assignments?.some(a => (a.staffId || a.staff_id) === staffId);
      if (!hasAssignment && !isOwnerOrAdmin && r.createdBy !== staffId) {
        return res.status(403).json({ error: true, message: 'Sin acceso' });
      }

      return res.json({ success: true, reminder: enrichWithMine(r, staffId) });
    } catch (err) {
      console.error('[ReminderController] getReminderById:', err);
      res.status(500).json({ error: true, message: 'Error obteniendo recordatorio' });
    }
  },

  // POST /reminders — Crear recordatorio
  async createReminder(req, res) {
    try {
      const staffId = req.staff.id;
      const { title, description, type = 'personal', priority = 'medium', dueDate, assignedTo = [],
              linkedEntityType, linkedEntityId, linkedEntityLabel } = req.body;

      if (!title?.trim()) {
        return res.status(400).json({ error: true, message: 'El título es requerido' });
      }

      const reminder = await sequelize.transaction(async (t) => {
        const r = await Reminder.create({
          title: title.trim(),
          description: description?.trim() || null,
          type,
          priority,
          dueDate: dueDate || null,
          createdBy: staffId,
          linkedEntityType: linkedEntityType || null,
          linkedEntityId: linkedEntityId ? String(linkedEntityId) : null,
          linkedEntityLabel: linkedEntityLabel?.trim() || null,
        }, { transaction: t });

        // Determinar a quiénes asignar
        let targetIds = [];
        if (type === 'personal') {
          targetIds = [staffId];
        } else if (type === 'tagged' && assignedTo.length > 0) {
          targetIds = [...new Set([...assignedTo, staffId])]; // incluir creador
        } else if (type === 'broadcast') {
          const allStaff = await Staff.findAll({ attributes: ['id'], where: { isActive: true }, transaction: t });
          targetIds = allStaff.map(s => s.id);
        }

        if (targetIds.length > 0) {
          await ReminderAssignment.bulkCreate(
            targetIds.map(id => ({ reminderId: r.id, staffId: id })),
            { transaction: t, ignoreDuplicates: true }
          );
        }

        return r;
      });

      // Recargar con todo incluido
      const full = await Reminder.findByPk(reminder.id, { include: reminderIncludes() });
      res.status(201).json({ success: true, reminder: enrichWithMine(full, staffId) });
    } catch (err) {
      console.error('[ReminderController] createReminder:', err);
      res.status(500).json({ error: true, message: 'Error creando recordatorio' });
    }
  },

  // PATCH /reminders/:id/complete — Marcar como completado
  // Body: { targetStaffId } — solo admin/owner pueden completar en nombre de otro
  async toggleComplete(req, res) {
    try {
      const myStaffId = req.staff.id;
      const role = req.staff.role;
      const { id } = req.params;
      const { targetStaffId } = req.body || {};

      const isOwnerOrAdmin = ['admin', 'owner'].includes(role);
      const staffIdToUse = (targetStaffId && isOwnerOrAdmin) ? targetStaffId : myStaffId;

      const assignment = await ReminderAssignment.findOne({
        where: { reminderId: id, staffId: staffIdToUse },
      });
      if (!assignment) {
        return res.status(404).json({ error: true, message: 'No tienes acceso a este recordatorio' });
      }

      assignment.completed = !assignment.completed;
      assignment.completedAt = assignment.completed ? new Date() : null;
      await assignment.save();

      res.json({
        success: true,
        completed: assignment.completed,
        completedAt: assignment.completedAt,
        assignmentId: assignment.id,
        staffId: staffIdToUse,
      });
    } catch (err) {
      console.error('[ReminderController] toggleComplete:', err);
      res.status(500).json({ error: true, message: 'Error actualizando estado' });
    }
  },

  // GET /reminders/board — Tablero agrupado por empleado
  async getBoardReminders(req, res) {
    try {
      const myStaffId = req.staff.id;
      const role = req.staff.role;
      const isOwnerOrAdmin = ['admin', 'owner'].includes(role);

      let staffList;
      const BOARD_ROLES = ['admin', 'owner', 'recept', 'finance'];

      if (isOwnerOrAdmin) {
        staffList = await Staff.findAll({
          where: { isActive: true, role: { [Op.in]: BOARD_ROLES } },
          attributes: ['id', 'name', 'role'],
          order: [['name', 'ASC']],
        });
      } else {
        staffList = [{ id: myStaffId, name: req.staff.name, role: req.staff.role, toJSON: () => ({ id: myStaffId, name: req.staff.name, role: req.staff.role }) }];
      }

      const staffIds = staffList.map(s => s.id || s.dataValues?.id);

      const assignments = await ReminderAssignment.findAll({
        where: { staffId: { [Op.in]: staffIds } },
        include: [{
          model: Reminder,
          as: 'reminder',
          required: true,
          // Owner/admin ven todas las tarjetas → excluir privados ajenos, pero mostrar los propios
          where: isOwnerOrAdmin ? {
            [Op.or]: [
              { type: { [Op.ne]: 'personal' } },
              { type: 'personal', createdBy: myStaffId },
            ],
          } : {},
          include: [{ model: Staff, as: 'creator', attributes: ['id', 'name'] }],
        }],
        order: [
          [{ model: Reminder, as: 'reminder' }, 'createdAt', 'DESC'],
        ],
      });

      // Group by staffId
      const staffMap = {};
      staffList.forEach(s => {
        const plain = s.toJSON ? s.toJSON() : s;
        staffMap[plain.id] = { ...plain, reminders: [] };
      });

      assignments.forEach(a => {
        const r = a.reminder.toJSON();
        const assignmentStaffId = a.staffId || a.staff_id;
        if (!staffMap[assignmentStaffId]) return;

        staffMap[assignmentStaffId].reminders.push({
          ...r,
          assignment: {
            id: a.id,
            completed: a.completed,
            completedAt: a.completedAt,
          },
        });
      });

      // Sort reminders inside each card: incomplete first, then by priority, then by dueDate
      Object.values(staffMap).forEach(staff => {
        staff.reminders.sort((a, b) => {
          if (a.assignment.completed !== b.assignment.completed) {
            return a.assignment.completed ? 1 : -1;
          }
          const pa = PRIORITY_ORDER[a.priority] ?? 2;
          const pb = PRIORITY_ORDER[b.priority] ?? 2;
          if (pa !== pb) return pa - pb;
          if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
          if (a.dueDate) return -1;
          if (b.dueDate) return 1;
          return 0;
        });
      });

      const ROLE_ORDER = { admin: 0, recept: 1, finance: 2, owner: 3 };
      const board = Object.values(staffMap).sort((a, b) => {
        const ra = ROLE_ORDER[a.role] ?? 99;
        const rb = ROLE_ORDER[b.role] ?? 99;
        if (ra !== rb) return ra - rb;
        return (a.name || '').localeCompare(b.name || '');
      });
      return res.json({ success: true, board });
    } catch (err) {
      console.error('[ReminderController] getBoardReminders:', err);
      res.status(500).json({ error: true, message: 'Error obteniendo tablero' });
    }
  },

  // DELETE /reminders/:id — Eliminar (solo owner)
  async deleteReminder(req, res) {
    try {
      const role = req.staff.role;
      const { id } = req.params;

      const reminder = await Reminder.findByPk(id);
      if (!reminder) return res.status(404).json({ error: true, message: 'Recordatorio no encontrado' });

      if (role !== 'owner') {
        return res.status(403).json({ error: true, message: 'No tienes permiso para eliminar este recordatorio' });
      }

      await reminder.destroy();
      res.json({ success: true, message: 'Recordatorio eliminado' });
    } catch (err) {
      console.error('[ReminderController] deleteReminder:', err);
      res.status(500).json({ error: true, message: 'Error eliminando recordatorio' });
    }
  },

  // POST /reminders/:id/comments — Agregar comentario
  async addComment(req, res) {
    try {
      const staffId = req.staff.id;
      const { id } = req.params;
      const { message, taggedStaffIds = [] } = req.body;

      if (!message?.trim()) {
        return res.status(400).json({ error: true, message: 'El comentario no puede estar vacío' });
      }

      // Verificar que el staff tiene acceso al recordatorio
      const { reminder, allowed } = await canViewReminder(id, staffId);
      if (!reminder) return res.status(404).json({ error: true, message: 'Recordatorio no encontrado' });
      if (!allowed) {
        return res.status(403).json({ error: true, message: 'No tienes acceso a este recordatorio' });
      }

      const normalizedTags = Array.isArray(taggedStaffIds)
        ? [...new Set(taggedStaffIds.filter(Boolean))]
        : [];

      const comment = await sequelize.transaction(async (t) => {
        const created = await ReminderComment.create({
          reminderId: id,
          staffId,
          message: message.trim(),
          taggedStaffIds: normalizedTags,
        }, { transaction: t });

        if (normalizedTags.length > 0) {
          await ReminderAssignment.bulkCreate(
            normalizedTags.map(taggedId => ({ reminderId: id, staffId: taggedId })),
            { transaction: t, ignoreDuplicates: true }
          );
        }

        return created;
      });

      const full = await ReminderComment.findByPk(comment.id, {
        include: [{ model: Staff, as: 'author', attributes: STAFF_ATTRS }],
      });

      res.status(201).json({ success: true, comment: full.toJSON() });
    } catch (err) {
      console.error('[ReminderController] addComment:', err);
      res.status(500).json({ error: true, message: 'Error agregando comentario' });
    }
  },

  // PATCH /reminders/:id/comments/:commentId — Editar comentario
  async updateComment(req, res) {
    try {
      const staffId = req.staff.id;
      const role = req.staff.role;
      const { id, commentId } = req.params;
      const { message, taggedStaffIds } = req.body;

      if (!message?.trim()) {
        return res.status(400).json({ error: true, message: 'El comentario no puede estar vacío' });
      }

      const { reminder, allowed } = await canViewReminder(id, staffId);
      if (!reminder) return res.status(404).json({ error: true, message: 'Recordatorio no encontrado' });
      if (!allowed && !['admin', 'owner'].includes(role)) {
        return res.status(403).json({ error: true, message: 'No tienes acceso a este recordatorio' });
      }

      const comment = await ReminderComment.findOne({ where: { id: commentId, reminderId: id } });
      if (!comment) {
        return res.status(404).json({ error: true, message: 'Comentario no encontrado' });
      }

      if (comment.staffId !== staffId && !['admin', 'owner'].includes(role)) {
        return res.status(403).json({ error: true, message: 'No tienes permiso para editar este comentario' });
      }

      const normalizedTags = Array.isArray(taggedStaffIds)
        ? [...new Set(taggedStaffIds.filter(Boolean))]
        : comment.taggedStaffIds || [];

      await sequelize.transaction(async (t) => {
        comment.message = message.trim();
        comment.taggedStaffIds = normalizedTags;
        await comment.save({ transaction: t });

        if (normalizedTags.length > 0) {
          await ReminderAssignment.bulkCreate(
            normalizedTags.map(taggedId => ({ reminderId: id, staffId: taggedId })),
            { transaction: t, ignoreDuplicates: true }
          );
        }
      });

      const full = await ReminderComment.findByPk(comment.id, {
        include: [{ model: Staff, as: 'author', attributes: STAFF_ATTRS }],
      });

      res.json({ success: true, comment: full.toJSON() });
    } catch (err) {
      console.error('[ReminderController] updateComment:', err);
      res.status(500).json({ error: true, message: 'Error editando comentario' });
    }
  },

  // DELETE /reminders/:id/comments/:commentId — Eliminar comentario
  async deleteComment(req, res) {
    try {
      const staffId = req.staff.id;
      const role = req.staff.role;
      const { commentId } = req.params;

      const comment = await ReminderComment.findByPk(commentId);
      if (!comment) return res.status(404).json({ error: true, message: 'Comentario no encontrado' });

      if (comment.staffId !== staffId && !['admin', 'owner'].includes(role)) {
        return res.status(403).json({ error: true, message: 'No tienes permiso para eliminar este comentario' });
      }

      await comment.destroy();
      res.json({ success: true });
    } catch (err) {
      console.error('[ReminderController] deleteComment:', err);
      res.status(500).json({ error: true, message: 'Error eliminando comentario' });
    }
  },

  // PATCH /reminders/:id — Editar recordatorio (solo creador o admin/owner)
  async updateReminder(req, res) {
    try {
      const staffId = req.staff.id;
      const role = req.staff.role;
      const { id } = req.params;
        const { title, description, priority, dueDate, type,
          assignedTo,
              linkedEntityType, linkedEntityId, linkedEntityLabel } = req.body;

      const reminder = await Reminder.findByPk(id);
      if (!reminder) return res.status(404).json({ error: true, message: 'Recordatorio no encontrado' });

      if (reminder.type === 'personal' && reminder.createdBy !== staffId) {
        return res.status(403).json({ error: true, message: 'No tienes permiso para editar este recordatorio' });
      }

      if (reminder.createdBy !== staffId && !['admin', 'owner'].includes(role)) {
        return res.status(403).json({ error: true, message: 'No tienes permiso para editar este recordatorio' });
      }

      await sequelize.transaction(async (t) => {
        if (title?.trim()) reminder.title = title.trim();
        if (description !== undefined) reminder.description = description?.trim() || null;
        if (priority) reminder.priority = priority;
        if (dueDate !== undefined) reminder.dueDate = dueDate || null;

        // Linked entity (can be cleared by passing linkedEntityType: '')
        if (linkedEntityType !== undefined) {
          reminder.linkedEntityType = linkedEntityType || null;
          reminder.linkedEntityId = linkedEntityId ? String(linkedEntityId) : null;
          reminder.linkedEntityLabel = linkedEntityLabel?.trim() || null;
        }

        let effectiveType = type || reminder.type;
        if (assignedTo !== undefined && Array.isArray(assignedTo)) {
          if (effectiveType === 'personal' && assignedTo.length > 0) effectiveType = 'tagged';
          if (effectiveType === 'tagged' && assignedTo.length === 0) effectiveType = 'personal';
        }

        if (type !== undefined || assignedTo !== undefined) {
          reminder.type = effectiveType;
        }

        await reminder.save({ transaction: t });

        if (type !== undefined || assignedTo !== undefined) {
          let targetIds = [];
          if (effectiveType === 'personal') {
            targetIds = [reminder.createdBy];
          } else if (effectiveType === 'tagged') {
            const safeAssigned = Array.isArray(assignedTo) ? assignedTo : [];
            targetIds = [...new Set([...safeAssigned, reminder.createdBy])];
          } else if (effectiveType === 'broadcast') {
            const allStaff = await Staff.findAll({
              attributes: ['id'],
              where: { isActive: true },
              transaction: t,
            });
            targetIds = allStaff.map(s => s.id);
          }

          await ReminderAssignment.destroy({ where: { reminderId: id }, transaction: t });

          if (targetIds.length > 0) {
            await ReminderAssignment.bulkCreate(
              targetIds.map(targetId => ({ reminderId: id, staffId: targetId })),
              { transaction: t }
            );
          }
        }
      });

      const full = await Reminder.findByPk(id, { include: reminderIncludes() });
      res.json({ success: true, reminder: enrichWithMine(full, staffId) });
    } catch (err) {
      console.error('[ReminderController] updateReminder:', err);
      res.status(500).json({ error: true, message: 'Error actualizando recordatorio' });
    }
  },
};
