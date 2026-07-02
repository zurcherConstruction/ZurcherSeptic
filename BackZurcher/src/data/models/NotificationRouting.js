const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const NotificationRouting = sequelize.define('NotificationRouting', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    eventType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      field: 'event_type',
    },
    staffId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Staffs', key: 'id' },
      onDelete: 'CASCADE',
      field: 'staff_id',
    },
  }, {
    tableName: 'NotificationRoutings',
    timestamps: true,
  });

  NotificationRouting.associate = (models) => {
    NotificationRouting.belongsTo(models.Staff, { foreignKey: 'staff_id', as: 'staff' });
  };

  return NotificationRouting;
};
