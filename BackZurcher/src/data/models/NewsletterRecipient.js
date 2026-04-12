const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  sequelize.define(
    "NewsletterRecipient",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      newsletterId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Newsletters',
          key: 'id',
        },
      },
      subscriberId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'NewsletterSubscribers',
          key: 'id',
        },
      },
      status: {
        type: DataTypes.ENUM('pending', 'sent', 'opened', 'clicked', 'bounced', 'failed'),
        defaultValue: 'pending',
        allowNull: false,
      },
      sentAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      openedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      clickedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      bouncedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      bounceReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      unsubscribedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        allowNull: true,
      },
    },
    {
      timestamps: true,
      updatedAt: 'updatedAt',
      createdAt: 'createdAt',
      indexes: [
        {
          unique: true,
          fields: ['newsletterId', 'subscriberId'],
        },
      ],
    }
  );
};
