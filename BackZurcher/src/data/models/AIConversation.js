const { DataTypes } = require('sequelize');

// 🤖 Conversación de ZurcherAI — cada una pertenece a un único staff
module.exports = (sequelize) => {
  return sequelize.define('AIConversation', {
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
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      defaultValue: 'Nueva conversación',
    },
    lastMessageAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'AIConversations',
    indexes: [{ fields: ['staffId', 'lastMessageAt'] }],
  });
};
