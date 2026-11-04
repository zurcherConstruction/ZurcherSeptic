const { DataTypes } = require('sequelize');

// ⭐ "Mis reportes": preguntas guardadas de cada usuario para repetirlas con un clic
module.exports = (sequelize) => {
  return sequelize.define('AISavedPrompt', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    staffId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(80), allowNull: false },
    prompt: { type: DataTypes.TEXT, allowNull: false },
  }, {
    tableName: 'AISavedPrompts',
  });
};
