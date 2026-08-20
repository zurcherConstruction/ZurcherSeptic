const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('StaffActivityLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    staffId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Staffs', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    endpoint: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    method: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'GET',
    },
    section: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  }, {
    timestamps: true,
    indexes: [
      { fields: ['staffId'], name: 'idx_sal_staff_id' },
      { fields: ['createdAt'], name: 'idx_sal_created_at' },
      { fields: ['staffId', 'createdAt'], name: 'idx_sal_staff_created' },
    ],
  });
};
