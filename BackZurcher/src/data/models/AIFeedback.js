const { DataTypes } = require('sequelize');

// 👍/👎 de un usuario sobre una respuesta de ZurcherAI (rating 1 o -1), para detectar errores
module.exports = (sequelize) => {
  return sequelize.define('AIFeedback', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    messageId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    conversationId: { type: DataTypes.UUID, allowNull: false },
    staffId: { type: DataTypes.UUID, allowNull: true },
    rating: { type: DataTypes.SMALLINT, allowNull: false },
    comment: { type: DataTypes.TEXT, allowNull: true },
  }, {
    tableName: 'AIFeedbacks',
  });
};
