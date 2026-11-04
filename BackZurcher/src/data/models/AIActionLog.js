const { DataTypes } = require('sequelize');

// ✅ Acción propuesta por ZurcherAI y confirmada por el usuario (tarea, nota, borrador de correo...).
// toolUseId es único: una propuesta solo se puede ejecutar una vez.
module.exports = (sequelize) => {
  return sequelize.define('AIActionLog', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    toolUseId: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    conversationId: { type: DataTypes.UUID, allowNull: false },
    staffId: { type: DataTypes.UUID, allowNull: true },
    actionType: { type: DataTypes.STRING(40), allowNull: false },
    result: { type: DataTypes.JSONB, allowNull: true },
  }, {
    tableName: 'AIActionLogs',
    updatedAt: false,
  });
};
