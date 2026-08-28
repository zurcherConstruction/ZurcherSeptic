const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('StaffAttendance', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    staffId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Staffs',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    customName: {
      type: DataTypes.STRING(200),
      allowNull: true,
   
    },
    workDate: {
      type: DataTypes.DATEONLY, // Solo fecha YYYY-MM-DD, sin timezone issues
      allowNull: false,
      comment: 'Fecha del día trabajado'
    },
    isPresent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'true si trabajó ese día, false si no'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas opcionales (ej: medio día, overtime, sick leave)'
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Staffs',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
      comment: 'Staff que marcó la asistencia'
    }
  }, {
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['staffId', 'workDate'], // Un registro por staff por día
        name: 'unique_staff_date'
      },
      {
        fields: ['workDate'], // Para filtros por fecha
        name: 'idx_work_date'
      },
      {
        fields: ['staffId'], // Para filtros por staff
        name: 'idx_staff_id'
      },
      {
        fields: ['workDate', 'isPresent'], // Para reportes rápidos
        name: 'idx_date_present'
      }
    ],
    comment: 'Registro diario de asistencia del staff'
  });
};