'use strict';

/**
 * 🔗 Notion — sincronización de prospectos con Sales Leads
 * Uso: node run-migration.js 20261118-notion-sync
 *
 * SalesLeads:
 *  - notion_page_id:     página de Notion vinculada (base "Seguimiento de Prospectos")
 *  - notion_synced_at:   última vez que el lead y la página quedaron iguales
 *  - notion_snapshot:    valores de la última sincronización (para saber qué cambió de cada lado)
 *  - notion_reminder_id: tarea de seguimiento del tablero creada desde Notion
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('SalesLeads');

    if (!columns.notion_page_id) {
      await queryInterface.addColumn('SalesLeads', 'notion_page_id', { type: Sequelize.STRING(64), allowNull: true });
      await queryInterface.addIndex('SalesLeads', ['notion_page_id'], { unique: true, name: 'sales_leads_notion_page_id_unique' });
      console.log('✅ SalesLeads.notion_page_id agregada');
    }
    if (!columns.notion_synced_at) {
      await queryInterface.addColumn('SalesLeads', 'notion_synced_at', { type: Sequelize.DATE, allowNull: true });
      console.log('✅ SalesLeads.notion_synced_at agregada');
    }
    if (!columns.notion_snapshot) {
      await queryInterface.addColumn('SalesLeads', 'notion_snapshot', { type: Sequelize.JSONB, allowNull: true });
      console.log('✅ SalesLeads.notion_snapshot agregada');
    }
    if (!columns.notion_reminder_id) {
      await queryInterface.addColumn('SalesLeads', 'notion_reminder_id', { type: Sequelize.UUID, allowNull: true });
      console.log('✅ SalesLeads.notion_reminder_id agregada');
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('SalesLeads');
    if (columns.notion_page_id) {
      await queryInterface.removeIndex('SalesLeads', 'sales_leads_notion_page_id_unique').catch(() => {});
      await queryInterface.removeColumn('SalesLeads', 'notion_page_id');
    }
    if (columns.notion_synced_at) await queryInterface.removeColumn('SalesLeads', 'notion_synced_at');
    if (columns.notion_snapshot) await queryInterface.removeColumn('SalesLeads', 'notion_snapshot');
    if (columns.notion_reminder_id) await queryInterface.removeColumn('SalesLeads', 'notion_reminder_id');
  },
};
