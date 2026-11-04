'use strict';

/**
 * 🤖 ZurcherAI — mejoras: modelo por conversación, acciones confirmadas, calificaciones y reportes guardados
 * Uso: node run-migration.js 20261104-ai-improvements
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    const conversationColumns = await queryInterface.describeTable('AIConversations');
    if (!conversationColumns.model) {
      await queryInterface.addColumn('AIConversations', 'model', { type: Sequelize.STRING(60), allowNull: true });
      console.log('✅ AIConversations.model agregada');
    }

    if (!tables.includes('AIActionLogs')) {
      await queryInterface.createTable('AIActionLogs', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        toolUseId: { type: Sequelize.STRING(100), allowNull: false, unique: true },
        conversationId: { type: Sequelize.UUID, allowNull: false },
        staffId: { type: Sequelize.UUID, allowNull: true, references: { model: 'Staffs', key: 'id' }, onDelete: 'SET NULL' },
        actionType: { type: Sequelize.STRING(40), allowNull: false },
        result: { type: Sequelize.JSONB, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      });
      await queryInterface.addIndex('AIActionLogs', ['conversationId']);
      console.log('✅ AIActionLogs creada');
    }

    if (!tables.includes('AIFeedbacks')) {
      await queryInterface.createTable('AIFeedbacks', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        messageId: { type: Sequelize.INTEGER, allowNull: false, unique: true, references: { model: 'AIMessages', key: 'id' }, onDelete: 'CASCADE' },
        conversationId: { type: Sequelize.UUID, allowNull: false },
        staffId: { type: Sequelize.UUID, allowNull: true, references: { model: 'Staffs', key: 'id' }, onDelete: 'SET NULL' },
        rating: { type: Sequelize.SMALLINT, allowNull: false },
        comment: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      });
      await queryInterface.addIndex('AIFeedbacks', ['createdAt']);
      console.log('✅ AIFeedbacks creada');
    }

    if (!tables.includes('AISavedPrompts')) {
      await queryInterface.createTable('AISavedPrompts', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        staffId: { type: Sequelize.UUID, allowNull: false, references: { model: 'Staffs', key: 'id' }, onDelete: 'CASCADE' },
        title: { type: Sequelize.STRING(80), allowNull: false },
        prompt: { type: Sequelize.TEXT, allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      });
      await queryInterface.addIndex('AISavedPrompts', ['staffId']);
      console.log('✅ AISavedPrompts creada');
    }

    if (!tables.includes('AISettings')) {
      await queryInterface.createTable('AISettings', {
        key: { type: Sequelize.STRING(60), primaryKey: true, allowNull: false },
        value: { type: Sequelize.JSONB, allowNull: true },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      });
      console.log('✅ AISettings creada');
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('AISettings');
    await queryInterface.dropTable('AISavedPrompts');
    await queryInterface.dropTable('AIFeedbacks');
    await queryInterface.dropTable('AIActionLogs');
    await queryInterface.removeColumn('AIConversations', 'model');
  },
};
