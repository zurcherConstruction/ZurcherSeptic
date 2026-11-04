'use strict';

/**
 * 💲 ZurcherAI — registro de consumo (tokens y costo) por pregunta
 * Uso: node run-migration.js 20261103-create-ai-usage-logs
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    if (tables.includes('AIUsageLogs')) {
      console.log('⏭️  AIUsageLogs ya existe, saltando.');
      return;
    }

    await queryInterface.createTable('AIUsageLogs', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      source: { type: Sequelize.STRING(20), allowNull: false },
      staffId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Staffs', key: 'id' },
        onDelete: 'SET NULL',
      },
      conversationId: { type: Sequelize.UUID, allowNull: true },
      model: { type: Sequelize.STRING(60), allowNull: true },
      requests: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      toolCalls: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      inputTokens: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      outputTokens: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      cacheReadTokens: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      cacheWriteTokens: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      costUsd: { type: Sequelize.DECIMAL(10, 5), allowNull: false, defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('AIUsageLogs', ['createdAt']);
    await queryInterface.addIndex('AIUsageLogs', ['staffId', 'createdAt']);
    console.log('✅ AIUsageLogs creada');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('AIUsageLogs');
  },
};
