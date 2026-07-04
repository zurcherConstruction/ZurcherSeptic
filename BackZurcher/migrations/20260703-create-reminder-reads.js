'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (tables.includes('ReminderReads')) {
      console.log('⏭️  ReminderReads ya existe, saltando.');
      return;
    }

    await queryInterface.createTable('ReminderReads', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      reminder_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Reminders', key: 'id' },
        onDelete: 'CASCADE',
      },
      staff_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Staffs', key: 'id' },
        onDelete: 'CASCADE',
      },
      last_read_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('ReminderReads', ['reminder_id', 'staff_id'], {
      unique: true,
      name: 'reminder_reads_reminder_staff_unique',
    });

    console.log('✅ Tabla ReminderReads creada con índice único (reminder_id, staff_id)');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ReminderReads');
  },
};
