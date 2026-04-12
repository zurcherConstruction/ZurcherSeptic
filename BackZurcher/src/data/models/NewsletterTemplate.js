const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  sequelize.define(
    "NewsletterTemplate",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      subject: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'Asunto predeterminado para emails que usen esta plantilla',
      },
      htmlContent: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Contenido HTML del email',
      },
      textContent: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Versión texto plano del email',
      },
      category: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Categoría: welcome, promotional, transactional, etc.',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      previewImageUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'URL de imagen de preview de la plantilla',
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
