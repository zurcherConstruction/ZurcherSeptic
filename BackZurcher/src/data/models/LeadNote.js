const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('LeadNote', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    leadId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'SalesLeads',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
      field: 'lead_id'
    },
    staffId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Staffs',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
      field: 'staff_id'
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'El mensaje no puede estar vacío'
        },
        len: {
          args: [1, 5000],
          msg: 'El mensaje debe tener entre 1 y 5000 caracteres'
        }
      }
    },
    noteType: {
      type: DataTypes.ENUM(
        'initial_contact',  // 📞 Primer contacto
        'follow_up',        // 🔄 Seguimiento
        'quote_sent',       // 💵 Cotización enviada
        'meeting',          // 🤝 Reunión/visita
        'email',            // ✉️ Email enviado/recibido
        'phone_call',       // 📞 Llamada telefónica
        'no_answer',        // ❌ Cliente no contestó
        'problem',          // ⚠️ Problema/objeción
        'progress',         // ✅ Avance positivo
        'status_change',    // 📋 Cambio de estado
        'other'             // 📝 Otro
      ),
      allowNull: false,
      defaultValue: 'follow_up',
      field: 'note_type'
    },
    relatedStatus: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Estado del lead cuando se creó la nota',
      field: 'related_status'
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'medium'
    },
    isResolved: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Para notas tipo "problem", indica si ya se resolvió',
      field: 'is_resolved'
    },
    
    // 🔔 SISTEMA DE ALERTAS
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Indica si la nota ha sido vista/leída',
      field: 'is_read'
    },
    readBy: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: true,
      defaultValue: [],
      comment: 'IDs de staff que han leído esta nota',
      field: 'read_by'
    },
    
    // ⏰ SISTEMA DE RECORDATORIOS
    reminderDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha/hora para recordatorio futuro',
      field: 'reminder_date'
    },
    reminderFor: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: true,
      defaultValue: [],
      comment: 'IDs de staff que deben recibir el recordatorio',
      field: 'reminder_for'
    },
    isReminderActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Si el recordatorio está activo',
      field: 'is_reminder_active'
    },
    reminderCompletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Cuándo se completó/canceló el recordatorio',
      field: 'reminder_completed_at'
    },
    reminderEmailSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha y hora en que se envió el email de recordatorio',
      field: 'reminder_email_sent_at'
    }
  }, {
    timestamps: true,
    underscored: true, // Usa snake_case para columnas automáticas (created_at, updated_at)
    tableName: 'LeadNotes',
    indexes: [
      {
        fields: ['lead_id']
      },
      {
        fields: ['staff_id']
      },
      {
        fields: ['note_type']
      },
      {
        fields: ['priority']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['reminder_date']
      },
      {
        fields: ['is_reminder_active']
      }
    ]
  });
};
