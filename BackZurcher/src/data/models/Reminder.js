const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Reminder = sequelize.define('Reminder', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: { notEmpty: true, len: [1, 200] }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM('personal', 'tagged', 'broadcast'),
      allowNull: false,
      defaultValue: 'personal',
      comment: 'personal=solo creador, tagged=usuarios específicos, broadcast=todos'
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'medium',
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fecha límite opcional',
      field: 'due_date'
    },
    linkedEntityType: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'linked_entity_type',
      comment: 'work | budget | workCalendar'
    },
    linkedEntityId: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'linked_entity_id',
    },
    linkedEntityLabel: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'linked_entity_label',
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Staffs', key: 'id' },
      onDelete: 'CASCADE',
      field: 'created_by'
    },
  }, {
    tableName: 'Reminders',
    timestamps: true,
  });

  // --- ReminderAssignment: quién ve el recordatorio y si lo completó ---
  const ReminderAssignment = sequelize.define('ReminderAssignment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    reminderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Reminders', key: 'id' },
      onDelete: 'CASCADE',
      field: 'reminder_id'
    },
    staffId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Staffs', key: 'id' },
      onDelete: 'CASCADE',
      field: 'staff_id'
    },
    completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at'
    },
  }, {
    tableName: 'ReminderAssignments',
    timestamps: true,
    indexes: [{ unique: true, fields: ['reminder_id', 'staff_id'] }]
  });

  // --- ReminderComment: comentarios/ayuda memoria ---
  const ReminderComment = sequelize.define('ReminderComment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    reminderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Reminders', key: 'id' },
      onDelete: 'CASCADE',
      field: 'reminder_id'
    },
    staffId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Staffs', key: 'id' },
      onDelete: 'SET NULL',
      field: 'staff_id'
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    taggedStaffIds: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: false,
      defaultValue: [],
      field: 'tagged_staff_ids'
    },
  }, {
    tableName: 'ReminderComments',
    timestamps: true,
  });

  // --- ReminderRead: registro de última lectura por staff por reminder ---
  const ReminderRead = sequelize.define('ReminderRead', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    reminderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Reminders', key: 'id' },
      onDelete: 'CASCADE',
      field: 'reminder_id',
    },
    staffId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Staffs', key: 'id' },
      onDelete: 'CASCADE',
      field: 'staff_id',
    },
    lastReadAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'last_read_at',
    },
  }, {
    tableName: 'ReminderReads',
    timestamps: false,
    indexes: [{ unique: true, fields: ['reminder_id', 'staff_id'] }],
  });

  // Associations definidas en associate hook
  ReminderRead.associate = (models) => {
    ReminderRead.belongsTo(models.Reminder, { foreignKey: 'reminder_id' });
    ReminderRead.belongsTo(models.Staff,    { foreignKey: 'staff_id' });
  };

  Reminder.associate = (models) => {
    Reminder.belongsTo(models.Staff, { foreignKey: 'created_by', as: 'creator' });
    Reminder.hasMany(models.ReminderAssignment, { foreignKey: 'reminder_id', as: 'assignments' });
    Reminder.hasMany(models.ReminderComment,    { foreignKey: 'reminder_id', as: 'comments' });
    Reminder.hasMany(models.ReminderRead,       { foreignKey: 'reminder_id', as: 'reads' });
  };

  ReminderAssignment.associate = (models) => {
    ReminderAssignment.belongsTo(models.Reminder, { foreignKey: 'reminder_id' });
    ReminderAssignment.belongsTo(models.Staff, { foreignKey: 'staff_id', as: 'staff' });
  };

  ReminderComment.associate = (models) => {
    ReminderComment.belongsTo(models.Reminder, { foreignKey: 'reminder_id' });
    ReminderComment.belongsTo(models.Staff, { foreignKey: 'staff_id', as: 'author' });
  };

  return Reminder;
};
