'use strict';

/**
 * 🤖 ZurcherAI — tablas de conversaciones por usuario
 * Uso: node run-migration.js 20261023-create-ai-conversations
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    if (!tables.includes('AIConversations')) {
      await queryInterface.createTable('AIConversations', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        staffId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'Staffs', key: 'id' },
          onDelete: 'CASCADE',
        },
        title: {
          type: Sequelize.STRING(200),
          allowNull: false,
          defaultValue: 'Nueva conversación',
        },
        lastMessageAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      });
      await queryInterface.addIndex('AIConversations', ['staffId', 'lastMessageAt'], {
        name: 'ai_conversations_staff_last_message',
      });
      console.log('✅ Tabla AIConversations creada');
    } else {
      console.log('⏭️  AIConversations ya existe, saltando.');
    }

    if (!tables.includes('AIMessages')) {
      await queryInterface.createTable('AIMessages', {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        conversationId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'AIConversations', key: 'id' },
          onDelete: 'CASCADE',
        },
        role: {
          type: Sequelize.ENUM('user', 'assistant'),
          allowNull: false,
        },
        content: { type: Sequelize.JSONB, allowNull: false },
        displayText: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      });
      await queryInterface.addIndex('AIMessages', ['conversationId', 'id'], {
        name: 'ai_messages_conversation_id',
      });
      console.log('✅ Tabla AIMessages creada');
    } else {
      console.log('⏭️  AIMessages ya existe, saltando.');
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('AIMessages');
    await queryInterface.dropTable('AIConversations');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_AIMessages_role";');
  },
};
