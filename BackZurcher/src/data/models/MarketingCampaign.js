const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('MarketingCampaign', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    
    // 📧 DATOS DE LA CAMPAÑA
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Asunto del email',
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Mensaje HTML del email',
    },
    imageUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'URL de la imagen incluida en el email',
      field: 'image_url'
    },
    design: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Diseño del email: { emailTitle, titleColor, titleFont }',
    },

    // 📊 DESTINATARIOS Y ESTADÍSTICAS
    recipientCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Cantidad total de destinatarios',
      field: 'recipient_count'
    },
    uniqueEmails: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Array de emails únicos enviados',
      field: 'unique_emails'
    },
    sentCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Emails enviados exitosamente',
      field: 'sent_count'
    },
    failedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Emails fallidos',
      field: 'failed_count'
    },
    failedEmails: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Lista de emails que fallaron y sus errores',
      field: 'failed_emails'
    },
    
    // 🎯 TIPO DE CAMPAÑA
    campaignType: {
      type: DataTypes.ENUM(
        'holiday',        // 🎄 Festivo (navidad, año nuevo, etc)
        'promotional',    // 🎁 Promocional
        'seasonal',       // 🍂 Estacional
        'informational',  // ℹ️ Informativo
        'other'           // 📋 Otro
      ),
      allowNull: false,
      defaultValue: 'holiday',
      field: 'campaign_type'
    },
    campaignName: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Nombre descriptivo de la campaña (ej: "Christmas 2026")',
      field: 'campaign_name'
    },
    
    // 👤 USUARIO QUE ENVIÓ
    sentByStaffId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Staffs',
        key: 'id'
      },
      comment: 'Usuario que ejecutó el envío',
      field: 'sent_by_staff_id'
    },
    
    // 📅 ESTADO Y FECHAS
    status: {
      type: DataTypes.ENUM(
        'draft',      // 📝 Borrador
        'sending',    // ⏳ Enviando
        'completed',  // ✅ Completado
        'failed'      // ❌ Fallido
      ),
      allowNull: false,
      defaultValue: 'draft',
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha y hora de inicio del envío',
      field: 'started_at'
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha y hora de finalización',
      field: 'completed_at'
    },
    
  }, {
    tableName: 'MarketingCampaigns',
    timestamps: true,
    underscored: false,
    indexes: [
      { fields: ['sent_by_staff_id'] },
      { fields: ['status'] },
      { fields: ['campaign_type'] },
      { fields: ['created_at'] },
    ]
  });
};
