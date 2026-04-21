const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  sequelize.define(
    "Newsletter",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Nombre interno de la campaña',
      },
      subject: {
        type: DataTypes.STRING(500),
        allowNull: false,
        comment: 'Asunto del email',
      },
      htmlContent: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Contenido HTML del email',
      },
      textContent: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Versión texto plano del email',
      },
      status: {
        type: DataTypes.ENUM('draft', 'scheduled', 'sending', 'sent', 'failed'),
        defaultValue: 'draft',
        allowNull: false,
      },
      templateId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'NewsletterTemplates',
          key: 'id',
        },
      },
      scheduledAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha programada de envío',
      },
      sentAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha real de envío',
      },
      recipientCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Total de destinatarios',
      },
      openedCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Total de aperturas',
      },
      clickedCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Total de clics',
      },
      bouncedCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Total de rebotes',
      },
      unsubscribedCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Total de desuscripciones',
      },
      sentCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Total de emails enviados exitosamente',
      },
      failedCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Total de emails fallidos',
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        allowNull: true,
        comment: 'Datos adicionales de la campaña',
      },
      createdByStaffId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'Staffs',
          key: 'id',
        },
      },
    },
    {
      paranoid: true,
      timestamps: true,
    }
  );
};
