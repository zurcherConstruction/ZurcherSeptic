const { DataTypes } = require('sequelize');
const { autoSubscribeToNewsletter } = require('../../utils/autoSubscribeNewsletter');

module.exports = (sequelize) => {
  const Work = sequelize.define('Work', {
    idWork: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
    },

    propertyAddress: {
      type: DataTypes.TEXT,
      allowNull: false, // Aseguramos que este campo sea obligatorio
    },
    idPermit: {
      type: DataTypes.UUID,
      allowNull: true, // Permitir NULL para Works sin Permit
      references: {
        model: 'Permits',
        key: 'idPermit',
      },
    },
    status: {
      type: DataTypes.ENUM(
        'pending',
        'assigned',
        'inProgress',
        'installed',
        'firstInspectionPending',
        'approvedInspection',
        'rejectedInspection',
        'coverPending',
        'covered',
        'invoiceFinal',
        'paymentReceived',
        'finalInspectionPending',
        'finalApproved',
        'finalRejected',
        'maintenance',
        'cancelled'
      ),
      allowNull: false,
      defaultValue: 'pending',
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    staffId: {
      type: DataTypes.UUID, // Clave foránea que referencia a Staff
      allowNull: true, // Permitir NULL si no todas las obras están asignadas
      references: {
        model: 'Staffs', // Nombre del modelo relacionado
        key: 'id', // Clave primaria del modelo Staff
      },
    },
    idBudget: {
      type: DataTypes.INTEGER, // Cambiado a INTEGER para coincidir con Budget
      allowNull: true,
      references: {
        model: 'Budgets',
        key: 'idBudget',
      },
    },
    stoneExtractionCONeeded: { // NUEVO CAMPO
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    maintenanceStartDate: {
      type: DataTypes.DATE,
      allowNull: true, // Permite nulo si la obra no está o nunca ha estado en mantenimiento
    },
    
    // --- IDENTIFICADOR DE TRABAJO IMPORTADO ---
    isLegacy: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: 'Indica si este trabajo fue importado desde sistema externo'
    },

    // --- NOTICE TO OWNER & LIEN TRACKING ---
    installationStartDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fecha cuando se inicia la instalación (status = inProgress). Inicia el período de 45 días'
    },
    noticeToOwnerRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si este trabajo requiere Notice to Owner'
    },
    noticeToOwnerFiled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si el Notice to Owner ya fue archivado'
    },
    noticeToOwnerFiledDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fecha cuando se archivó el Notice to Owner'
    },
    noticeToOwnerDocumentUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'notice_to_owner_document_url',
      comment: 'URL del documento Notice to Owner en Cloudinary'
    },
    noticeToOwnerPublicId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'notice_to_owner_public_id',
      comment: 'Public ID de Cloudinary para el Notice to Owner'
    },
    noticeToOwnerSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'notice_to_owner_sent_at',
      comment: 'Fecha y hora cuando se subió el Notice to Owner'
    },
    lienRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si este trabajo requiere Lien'
    },
    lienFiled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si el Lien ya fue archivado'
    },
    lienFiledDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fecha cuando se archivó el Lien'
    },
    lienDocumentUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'lien_document_url',
      comment: 'URL del documento Lien en Cloudinary'
    },
    lienPublicId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'lien_public_id',
      comment: 'Public ID de Cloudinary para el Lien'
    },
    lienSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'lien_sent_at',
      comment: 'Fecha y hora cuando se subió el Lien'
    },
    noticeToOwnerNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas sobre Notice to Owner y Lien'
    },

    // --- DOCUMENTOS FINALES ---
    operatingPermitUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL del Permiso de Operación en Cloudinary'
    },
    operatingPermitPublicId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Public ID de Cloudinary para el Permiso de Operación'
    },
    operatingPermitSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha y hora cuando se envió el Permiso de Operación al cliente'
    },
    maintenanceServiceUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL del Servicio de Mantenimiento en Cloudinary'
    },
    maintenanceServicePublicId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Public ID de Cloudinary para el Servicio de Mantenimiento'
    },
    maintenanceServiceSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha y hora cuando se envió el Servicio de Mantenimiento al cliente'
    },
    extraDocumentUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL del documento/imagen extra en Cloudinary'
    },
    extraDocumentPublicId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Public ID de Cloudinary para el documento/imagen extra'
    },
    extraDocumentSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha y hora cuando se subió el documento/imagen extra'
    }

  }, {
    hooks: {
      // 🔄 Hook automático: Registrar cambios de estado en WorkStateHistory Y crear WorkNote
      beforeUpdate: async (work, options) => {
        // 📅 GUARDAR FECHA DE INICIO DE INSTALACIÓN
        if (work.changed('status') && work.status === 'inProgress' && !work.installationStartDate) {
          work.installationStartDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
          console.log(`📅 Installation start date guardada: ${work.installationStartDate}`);
        }

        // Solo registrar si cambió el status
        if (work.changed('status')) {
          const WorkStateHistory = sequelize.models.WorkStateHistory;
          const WorkNote = sequelize.models.WorkNote;
          
          const fromStatus = work._previousDataValues.status;
          const toStatus = work.status;
          const changedBy = options.staffId || null; // Pasar staffId en options al actualizar
          
          // 1️⃣ Registrar en historial
          await WorkStateHistory.create({
            workId: work.idWork,
            fromStatus: fromStatus,
            toStatus: toStatus,
            changedBy: changedBy,
            reason: options.reason || null,
            changedAt: new Date()
          });

          // 2️⃣ Crear nota automática con el cambio de estado
          const statusLabels = {
            pending: 'Pendiente',
            assigned: 'Asignado',
            inProgress: 'En Progreso',
            installed: 'Instalado',
            firstInspectionPending: 'Inspección Pendiente',
            approvedInspection: 'Inspección Aprobada',
            rejectedInspection: 'Inspección Rechazada',
            coverPending: 'Tapar Pendiente',
            covered: 'Tapado',
            invoiceFinal: 'Factura Final',
            paymentReceived: 'Pago Recibido',
            finalInspectionPending: 'Inspección Final Pendiente',
            finalApproved: 'Aprobado Final',
            finalRejected: 'Rechazado Final',
            maintenance: 'Mantenimiento',
            cancelled: 'Cancelado'
          };

          const fromLabel = statusLabels[fromStatus] || fromStatus;
          const toLabel = statusLabels[toStatus] || toStatus;
          
          const message = `Estado actualizado automáticamente: ${fromLabel} → ${toLabel}`;

          await WorkNote.create({
            workId: work.idWork,
            staffId: changedBy, // Puede ser null si es automático
            message: message,
            noteType: 'status_change',
            priority: 'medium',
            relatedStatus: toStatus,
            isResolved: true, // Siempre resuelto porque es informativo
            mentionedStaffIds: []
          });

          console.log(`✅ WorkStateHistory y WorkNote registrados: ${fromStatus} → ${toStatus}`);
        }
      },
      
      // 📧 Auto-suscribir al Newsletter cuando se crea un Work (via Budget)
      afterCreate: async (work, options) => {
        try {
          // Cargar el Budget asociado para obtener el email
          const Budget = sequelize.models.Budget;
          if (work.budgetId) {
            const budget = await Budget.findByPk(work.budgetId, {
              attributes: ['applicantEmail', 'applicantName', 'propertyAddress']
            });
            
            if (budget && budget.applicantEmail) {
              await autoSubscribeToNewsletter(
                budget.applicantEmail,
                budget.applicantName,
                'work',
                {
                  propertyAddress: work.propertyAddress || budget.propertyAddress,
                  workId: work.idWork,
                  budgetId: work.budgetId,
                  subscribedFrom: 'work_creation'
                }
              );
            }
          }
        } catch (error) {
          console.error('Error en Work afterCreate hook:', error);
          // No lanzar error para no interrumpir la creación del Work
        }
      }
    }
  });

  return Work;
};
