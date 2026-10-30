'use strict';

/**
 * 🗺️ Mapas de trabajos — caché de coordenadas por dirección
 * Uso: node run-migration.js 20261030-create-geo-locations
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    if (tables.includes('GeoLocations')) {
      console.log('⏭️  GeoLocations ya existe, saltando.');
      return;
    }

    await queryInterface.createTable('GeoLocations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      addressKey: { type: Sequelize.STRING(300), allowNull: false, unique: true },
      address: { type: Sequelize.STRING(300), allowNull: false },
      latitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      longitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      status: { type: Sequelize.ENUM('ok', 'not_found'), allowNull: false, defaultValue: 'ok' },
      source: { type: Sequelize.STRING(20), allowNull: true },
      geocodedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    console.log('✅ Tabla GeoLocations creada');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('GeoLocations');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_GeoLocations_status";');
  },
};
