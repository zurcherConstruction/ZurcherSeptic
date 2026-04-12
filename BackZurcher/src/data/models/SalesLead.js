const { DataTypes } = require('sequelize');
const { autoSubscribeToNewsletter } = require('../../utils/autoSubscribeNewsletter');

module.exports = (sequelize) => {
  return sequelize.define('SalesLead', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // 👤 DATOS DEL PROSPECTO (coinciden con campos de Permit)
    applicantName: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'El nombre del cliente es obligatorio'
        }
      },
      field: 'applicant_name'
    },
    applicantEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: {
          msg: 'Formato de email inválido'
        }
      },
      field: 'applicant_email',
      set(value) {
        // Convertir strings vacíos a null para que no fallen las validaciones
        this.setDataValue('applicantEmail', value?.trim() || null);
      }
    },
    applicantPhone: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Teléfono del cliente',
      field: 'applicant_phone'
    },
    propertyAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Dirección de la propiedad donde se haría el trabajo',
      field: 'property_address'
    },
    
    // 🎯 GESTIÓN DEL LEAD
    status: {
      type: DataTypes.ENUM(
        'new',           // 🆕 Nuevo lead sin contactar
        'contacted',     // 📞 Ya contactado
        'interested',    // 👍 Cliente interesado
        'quoted',        // 💵 Cotización enviada
        'negotiating',   // 🤝 En negociación
        'won',           // ✅ Venta cerrada (convertido a Budget)
        'lost',          // ❌ Perdido/rechazado
        'archived'       // 📦 Archivado
      ),
      allowNull: false,
      defaultValue: 'new'
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'medium'
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'Etiquetas: septic-tank, commercial, urgent, etc.'
    },
    
    // 📋 ORIGEN Y DETALLES
    source: {
      type: DataTypes.ENUM(
        'website',       // Sitio web
        'phone_call',    // Llamada telefónica
        'email',         // Email directo
        'referral',      // Referido
        'social_media',  // Redes sociales
        'walk_in',       // Presencial
        'other'          // Otro
      ),
      allowNull: false,
      defaultValue: 'website',
      comment: 'Origen del lead'
    },
    serviceType: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Tipo de servicio solicitado: septic, plumbing, etc.',
      field: 'service_type'
    },
    estimatedValue: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Valor estimado del proyecto en dólares',
      field: 'estimated_value'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas iniciales o descripción del proyecto'
    },
    
    // 📅 FECHAS IMPORTANTES
    firstContactDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha del primer contacto con el cliente',
      field: 'first_contact_date'
    },
    lastActivityDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de última actividad/nota',
      field: 'last_activity_date'
    },
    
    // 🔗 CONVERSIÓN A PRESUPUESTO
    convertedToBudgetId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Budgets',
        key: 'idBudget'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
      comment: 'ID del presupuesto cuando se convierte a venta',
      field: 'converted_to_budget_id'
    },
    conversionDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha en que se convirtió a presupuesto/venta',
      field: 'conversion_date'
    },
    proposalSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha en que se envió la propuesta por email',
      field: 'proposal_sent_at'
    },
    
    // 👤 CREACIÓN
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Staffs',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
      comment: 'Staff que creó el lead',
      field: 'created_by'
    },
  }, {
    timestamps: true,
    underscored: true, // Usa snake_case para columnas automáticas (created_at, updated_at)
    tableName: 'SalesLeads',
    hooks: {
      // 📧 Auto-suscribir al Newsletter cuando se crea un Sales Lead con email
      afterCreate: async (salesLead, options) => {
        if (salesLead.applicantEmail) {
          await autoSubscribeToNewsletter(
            salesLead.applicantEmail,
            salesLead.applicantName,
            'sales_lead',
            {
              propertyAddress: salesLead.propertyAddress,
              salesLeadId: salesLead.id,
              source: salesLead.source,
              subscribedFrom: 'sales_lead_creation'
            }
          );
        }
      }
    },
    indexes: [
      {
        fields: ['status']
      },
      {
        fields: ['priority']
      },
      {
        fields: ['created_by']
      },
      {
        fields: ['applicant_name']
      },
      {
        fields: ['applicant_email']
      },
      {
        fields: ['applicant_phone']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['last_activity_date']
      },
      {
        // Índice GIN para búsquedas en tags (array)
        fields: ['tags'],
        using: 'gin'
      }
    ]
  });
};
