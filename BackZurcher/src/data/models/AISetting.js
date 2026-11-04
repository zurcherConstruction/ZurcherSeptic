const { DataTypes } = require('sequelize');

// ⚙️ Configuración de ZurcherAI editable desde la pantalla (ej. presupuesto mensual)
module.exports = (sequelize) => {
  return sequelize.define('AISetting', {
    key: { type: DataTypes.STRING(60), primaryKey: true },
    value: { type: DataTypes.JSONB, allowNull: true },
  }, {
    tableName: 'AISettings',
    createdAt: false,
  });
};
