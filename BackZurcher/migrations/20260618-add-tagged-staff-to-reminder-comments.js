'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDefinition = await queryInterface.describeTable('ReminderComments');
    if (!tableDefinition.tagged_staff_ids) {
      await queryInterface.addColumn('ReminderComments', 'tagged_staff_ids', {
        type: Sequelize.ARRAY(Sequelize.UUID),
        allowNull: false,
        defaultValue: [],
        comment: 'Staff IDs etiquetados en el comentario',
      });
    }
  },

  async down(queryInterface) {
    const tableDefinition = await queryInterface.describeTable('ReminderComments');
    if (tableDefinition.tagged_staff_ids) {
      await queryInterface.removeColumn('ReminderComments', 'tagged_staff_ids');
    }
  },
};
