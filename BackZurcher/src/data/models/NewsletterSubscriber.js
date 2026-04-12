const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  sequelize.define(
    "NewsletterSubscriber",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('active', 'unsubscribed', 'bounced'),
        defaultValue: 'active',
        allowNull: false,
      },
      source: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Origen de la suscripción: website, import, manual, etc.',
      },
      tags: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        defaultValue: [],
        allowNull: true,
        comment: 'Tags para segmentación: residential, commercial, etc.',
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        allowNull: true,
        comment: 'Datos adicionales del suscriptor',
      },
      confirmedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de confirmación de suscripción (double opt-in)',
      },
      unsubscribedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      unsubscribeReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      paranoid: true,
      timestamps: true,
    }
  );
};
