const { DataTypes } = require('sequelize');

// 🤖 Mensaje de una conversación de ZurcherAI.
// Guarda el transcript completo de la API (incluye tool_use / tool_result / thinking)
// para poder reenviarlo sin modificaciones en el siguiente turno.
module.exports = (sequelize) => {
  return sequelize.define('AIMessage', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    conversationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'AIConversations', key: 'id' },
      onDelete: 'CASCADE',
    },
    role: {
      type: DataTypes.ENUM('user', 'assistant'),
      allowNull: false,
    },
    content: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: 'Bloques de contenido tal cual se envían/reciben de la API de Claude',
    },
    displayText: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Texto a mostrar en el chat (solo pregunta del usuario y respuesta final); null en pasos intermedios',
    },
  }, {
    tableName: 'AIMessages',
    updatedAt: false,
    indexes: [{ fields: ['conversationId', 'id'] }],
  });
};
