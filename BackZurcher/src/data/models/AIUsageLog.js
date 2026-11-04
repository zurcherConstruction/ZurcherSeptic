const { DataTypes } = require('sequelize');

// 💲 Consumo de la API de Claude: una fila por pregunta (ZurcherAI) o por mensaje del chat de la web,
// con los tokens sumados de todas las vueltas y el costo estimado en USD.
module.exports = (sequelize) => {
  return sequelize.define('AIUsageLog', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    source: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: 'zurcherai | webbot',
    },
    staffId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'Staffs', key: 'id' },
      onDelete: 'SET NULL',
    },
    conversationId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    model: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    requests: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Llamadas a la API en esta pregunta (una por cada vuelta de herramientas)',
    },
    toolCalls: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    inputTokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    outputTokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    cacheReadTokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    cacheWriteTokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    costUsd: { type: DataTypes.DECIMAL(10, 5), allowNull: false, defaultValue: 0 },
  }, {
    tableName: 'AIUsageLogs',
    updatedAt: false,
    indexes: [
      { fields: ['createdAt'] },
      { fields: ['staffId', 'createdAt'] },
    ],
  });
};
