'use strict';

/**
 * 📧 Campañas de marketing — guardar el diseño del email (título, color, fuente)
 * Uso: node run-migration.js 20261125-campaign-design
 *
 * Así "Reintentar fallidos" reenvía con el mismo título de la campaña original.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('MarketingCampaigns');
    if (!columns.design) {
      await queryInterface.addColumn('MarketingCampaigns', 'design', { type: Sequelize.JSONB, allowNull: true });
      console.log('✅ MarketingCampaigns.design agregada');
    } else {
      console.log('ℹ️ MarketingCampaigns.design ya existe');
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('MarketingCampaigns');
    if (columns.design) await queryInterface.removeColumn('MarketingCampaigns', 'design');
  },
};
