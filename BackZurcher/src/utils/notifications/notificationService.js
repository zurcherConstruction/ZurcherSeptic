const { Staff } = require('../../data');
const { Op } = require('sequelize'); // Asegúrate de importar Op para usar operadores de Sequelize

// NOTE: We intentionally do NOT use a hard-coded corporate email map here.
// Recipient selection will rely on the Staff DB (preferred) and per-state getStaff overrides.

// Mapeo de estados a roles y mensajes
const stateNotificationMap = {
  initial_inspection_approved: {
    roles: ['owner'],
    message: (work, context) => `El trabajo con dirección ${work.propertyAddress} ha sido aprobado en la inspección inicial (registro rápido). Inspección ID: ${context?.inspectionId || 'N/A'}.`,
  },
  initial_inspection_rejected: {
    roles: ['owner'],
    message: (work, context) => {
      let msg = `El trabajo con dirección ${work.propertyAddress} ha sido rechazado en la inspección inicial (registro rápido).`;
      if (context?.inspectionId) msg += `\nInspección ID: ${context.inspectionId}`;
      if (context?.notes) msg += `\nNotas: ${context.notes}`;
      if (work.resultDocumentUrl) msg += `\nImagen/PDF: ${work.resultDocumentUrl}`;
      return msg;
    },
  },
  final_inspection_approved_maintenance: {
    roles: ['owner'],
    message: (work, context) => `El trabajo con dirección ${work.propertyAddress} ha sido aprobado en la inspección final (registro rápido) y pasa a mantenimiento. Inspección ID: ${context?.inspectionId || 'N/A'}.`,
  },
  final_inspection_rejected: {
    roles: ['owner'],
    message: (work, context) => `El trabajo con dirección ${work.propertyAddress} ha sido rechazado en la inspección final (registro rápido). Inspección ID: ${context?.inspectionId || 'N/A'}. Notas: ${context?.notes || 'Sin notas.'}`,
  },
  pending: {
    roles: ['owner', 'recept'], // Finance debe saber sobre compras pendientes 
        message: (work) => {
          let startDateFormatted = 'fecha no definida';
          if (work?.startDate && /^\d{4}-\d{2}-\d{2}$/.test(work.startDate)) {
            const [year, month, day] = work.startDate.split('-');
            startDateFormatted = `${day}/${month}/${year}`;
          } else if (work?.startDate) {
            startDateFormatted = work.startDate;
          }
          return `El trabajo con dirección ${work.propertyAddress} ya fue confirmado. Por favor, compra los materiales necesarios para la fecha ${startDateFormatted}.<br><a href="https://www.zurcherseptic.com/materiales" style="background:#1976d2;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none;display:inline-block;margin-top:8px;">Ir a la compra de materiales</a>`;
        },
  },
 assigned: {
  roles: ['owner', 'recept'], // Roles que reciben email
  subject: (work) => `Trabajo Asignado: ${work?.propertyAddress || 'Dirección desconocida'}`,
    message: (work) => {
    let assignedDisplay = 'desconocido';
    if (work?.Staff?.name) {
      assignedDisplay = work.Staff.name;
    } else if (work?.Staff?.email) {
      assignedDisplay = work.Staff.email;
    } else if (work?.staffId) {
      assignedDisplay = `ID ${work.staffId}`;
    }
    let startDateFormatted = 'fecha no definida';
    if (work?.startDate && /^\d{4}-\d{2}-\d{2}$/.test(work.startDate)) {
      const [year, month, day] = work.startDate.split('-');
      startDateFormatted = `${day}/${month}/${year}`;
    } else if (work?.startDate) {
      startDateFormatted = work.startDate;
    }
    return `Se ha asignado el trabajo en ${work?.propertyAddress || 'Dirección desconocida'} a ${assignedDisplay}.<br>` +
      `La fecha de inicio programada es: ${startDateFormatted}.<br>` +
      `Por favor, coordinar la compra de materiales necesarios para esta fecha.<br>` +
      `<a href="https://www.zurcherseptic.com/materiales" style="background:#1976d2;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none;display:inline-block;margin-top:8px;">Ir a la compra de materiales</a>`;
  },
  getStaff: async (work) => {
    if (!work?.staffId) {
      // Si no hay asignado, notificar solo a admin/owner/recept
      return await Staff.findAll({ where: { role: ['owner','recept'] } });
    }
    // Buscar al trabajador asignado Y a los roles de gestión
    const staff = await Staff.findAll({
      where: {
        [Op.or]: [
          { id: work.staffId }, // El trabajador asignado
          { role: ['owner', 'recept'] } // Los roles de gestión
        ]
      }
    });
    return staff;
  }
},
  inProgress: {
    roles: ['owner'], 
        message: (work) => {
          let startDateFormatted = 'fecha no definida';
          if (work?.startDate && /^\d{4}-\d{2}-\d{2}$/.test(work.startDate)) {
            const [year, month, day] = work.startDate.split('-');
            startDateFormatted = `${day}/${month}/${year}`;
          } else if (work?.startDate) {
            startDateFormatted = work.startDate;
          }
          return `Los materiales ya fueron comprados para la dirección ${work.propertyAddress}, La fecha de Instalación es el día: ${startDateFormatted}.`;
        },
  },
  installed: {
    roles: ['admin', 'owner'],
    message: (work) => `El trabajo con dirección ${work.propertyAddress} ha sido instalado. Por favor, solicita la primera inspección.`,
  },
  firstInspectionPending: {
    roles: [ 'owner'], 
    message: (work) => `El trabajo con dirección ${work.propertyAddress} está pendiente de la primera inspección. Esperando respuesta del inspector.`,
  },
  approvedInspection: {
    roles: ['owner'], 
    message: (work) => `El trabajo con dirección ${work.propertyAddress} ha pasado la inspección inicial. Por favor, procede con las tareas asignadas.`,
  },
  rejectedInspection: {
    roles: ['owner'], 
    message: (work) => `El trabajo con dirección ${work.propertyAddress} ha sido rechazado en la inspección inicial. Por favor, revisa los detalles y toma las medidas necesarias.`,
  },
  initial_correction_ready: {
    roles: ['owner'],
    message: (work, context) => `El trabajador ha marcado las correcciones como realizadas para la inspección inicial rechazada en ${work.propertyAddress}. Por favor, solicita la reinspección. Inspección ID: ${context?.inspectionId || 'N/A'}.`,
  },
  final_correction_ready: {
    roles: ['owner'],
    message: (work, context) => `El trabajador ha marcado las correcciones como realizadas para la inspección final rechazada en ${work.propertyAddress}. Por favor, solicita la reinspección final. Inspección ID: ${context?.inspectionId || 'N/A'}.`,
  },
   reinspection_initial_requested: { // Added new status
    roles: ['owner'], // Define appropriate roles
    message: (work, context) => `Se ha solicitado una reinspección inicial para la obra en ${work.propertyAddress}. Inspección ID: ${context?.inspectionId || 'N/A'}.`,
  },
  completed: {
    roles: ['owner'],
    message: (work) => `El trabajo con dirección ${work.propertyAddress} ha sido completado. Por favor, revisa el estado final.`,
  },
  coverPending: {
    roles: ['owner'], 
    message: (work) => `El trabajo con dirección ${work.propertyAddress} esta listo para ser tapado.`,
  },
  covered: {
    roles: ['owner', 'admin'],
    message: (work) => `El trabajo con dirección ${work.propertyAddress} ha sido Tapado. Por favor, revisa los detalles y envía el Invoice Final.`,
  },
  invoiceFinal: {
    roles: ['owner'], // Finance debe saber cuando se envía factura final
    message: (work) => `El Invoice final del trabajo con dirección ${work.propertyAddress} ha sido enviada al cliente. Esperando pago.`,
  },
  finalInspectionPending: {
    roles: ['owner'], 
    message: (work) => `El trabajo con dirección ${work.propertyAddress} está pendiente de la inspección final. Por favor, coordina con el inspector.`,
  },
  finalApproved: {
    roles: ['owner'], 
    message: (work) => `El trabajo con dirección ${work.propertyAddress} ha sido aprobado en la inspección final. El proyecto está completo.`,
  },
  finalRejected: {
    roles: ['owner'], 
    message: (work) => `El trabajo con dirección ${work.propertyAddress} ha sido rechazado en la inspección final. Por favor, revisa los detalles.`,
  },
    reinspection_final_requested: { // Added new status
    roles: ['owner'], // Define appropriate roles
    message: (work, context) => `Se ha solicitado una reinspección final para la obra en ${work.propertyAddress}. Inspección ID: ${context?.inspectionId || 'N/A'}.`,
  },
  maintenance: {
    roles: ['owner'], 
    message: (work) => `El trabajo con dirección ${work.propertyAddress} está en mantenimiento. Por favor, realiza las tareas asignadas.`,
  },
  budgetCreated: {
    roles: [ 'owner'], // Incluir finance en presupuestos
    message: (work) => `El presupuesto para la dirección ${work.propertyAddress} está listo para ser enviado al cliente.`,
  },
  
  // ✅ NUEVA NOTIFICACIÓN PARA ERRORES DE PDF
  budgetPdfError: {
    roles: ['admin', 'owner'], // Admin y owner reciben errores de PDF
    message: (budget) => `⚠️ ERROR: No se pudo generar el PDF para el presupuesto ${budget?.idBudget || budget?.id || 'N/A'} en ${budget?.propertyAddress || budget?.address || 'Dirección desconocida'}. Error: ${budget?.error || 'sin detalle'}. Se requiere intervención manual.`,
  },
  
  budgetSent: {
    roles: ['owner'], // Incluir finance cuando se envía presupuesto
    message: (work) => `El presupuesto para la dirección ${work.propertyAddress} ha sido enviado al cliente.`,
  },
   budgetSentToSignNow: {
    roles: ['owner'], // Incluir finance en firmas de presupuesto
    message: (data) => {
      const id = data?.idBudget || data?.id || 'N/A';
      const addr = data?.propertyAddress || data?.address || 'Dirección desconocida';
      const applicantName = data?.applicantName || data?.applicant || 'solicitante';
      const applicantEmail = data?.applicantEmail || data?.applicantEmailAddress || 'N/A';
      return `El presupuesto #${id} para la dirección ${addr} ha sido enviado a ${applicantName} (${applicantEmail}) para su firma digital.`;
    }
  },
  
  // 🆕 NUEVAS NOTIFICACIONES PARA WORKFLOW DE REVISIÓN
  budgetSentForReview: {
    roles: ['owner'],
    message: (data) => {
      const id = data?.idBudget || 'N/A';
      const addr = data?.propertyAddress || 'Dirección desconocida';
      const applicantName = data?.applicantName || 'cliente';
      const applicantEmail = data?.applicantEmail || 'N/A';
      const isResend = data?.isResend || false;
      
      if (isResend) {
        return `🔄 El presupuesto #${id} para ${addr} ha sido ACTUALIZADO y REENVIADO a ${applicantName} (${applicantEmail}) para revisión preliminar.`;
      }
      
      return `📧 El presupuesto #${id} para ${addr} ha sido enviado a ${applicantName} (${applicantEmail}) para revisión preliminar (sin firma).`;
    }
  },
  
  budgetApprovedByClient: {
    roles: ['admin', 'owner'], // ✅ MANTENER admin - CRÍTICO saber cuando cliente aprueba
    message: (data) => {
      const id = data?.idBudget || 'N/A';
      const addr = data?.propertyAddress || 'Dirección desconocida';
      const applicantName = data?.applicantName || 'El cliente';
      return `✅ ${applicantName} ha APROBADO el presupuesto #${id} para ${addr}. Ahora puede enviarse para firma digital.`;
    }
  },
  
  budgetRejectedByClient: {
    roles: ['admin', 'owner'],
    message: (data) => {
      const id = data?.idBudget || 'N/A';
      const addr = data?.propertyAddress || 'Dirección desconocida';
      const applicantName = data?.applicantName || 'El cliente';
      const reason = data?.reason || 'No especificada';
      return `❌ ${applicantName} ha RECHAZADO el presupuesto #${id} para ${addr}. Razón: ${reason}`;
    }
  },
  
  incomeCreated: {
    roles: ['owner', 'finance'],
    // 'income' ahora tiene las propiedades extra añadidas
    message: (income) => {
      const paymentReceived = parseFloat(income.amount || 0);
      const budgetTotal = parseFloat(income.budgetTotal || 0); // Usar el total real
      const initialPercentage = parseFloat(income.budgetInitialPercentage || 0); // Usar el % real
      const remainingPercentage = 100 - initialPercentage;
      const remainingAmount = budgetTotal - paymentReceived;

      // Validar que los cálculos tengan sentido
      if (budgetTotal <= 0 || initialPercentage <= 0) {
         return `Se registró el pago inicial de $${paymentReceived.toFixed(2)} para la obra en ${income.propertyAddress || 'N/A'}. (No se pudo calcular desglose).`;
      }

      return `Se registro Pago inicial de (${initialPercentage}%) de $${paymentReceived.toFixed(2)} registrado para ${income.propertyAddress || 'N/A'}. ` +
             `Total Presupuesto: $${budgetTotal.toFixed(2)}. ` +
             `Restante (${remainingPercentage}%): $${remainingAmount.toFixed(2)}.`;
    }
  },
  
  // ✅ NUEVAS NOTIFICACIONES FINANCIERAS
  expenseCreated: {
    roles: ['owner', 'finance'], // Admin NO necesita cada gasto
    message: (expense) => {
      const amount = parseFloat(expense.amount || 0);
      const expenseType = expense.typeExpense || 'Gasto';
      const staffName = expense.Staff?.name || 'Staff desconocido';
      const paymentMethod = expense.paymentMethod || 'No especificado';
      const notes = expense.notes || '';
      
      // Si está asociado a un Work, mostrar dirección
      if (expense.work?.propertyAddress || expense.propertyAddress) {
        const workAddress = expense.work?.propertyAddress || expense.propertyAddress;
        return `💰 <strong>Nuevo Gasto Registrado</strong><br><br>` +
               `<strong>Monto:</strong> $${amount.toFixed(2)}<br>` +
               `<strong>Tipo:</strong> ${expenseType}<br>` +
               `<strong>Método de Pago:</strong> ${paymentMethod}<br>` +
               `<strong>Registrado por:</strong> ${staffName}<br>` +
               `<strong>Proyecto:</strong> ${workAddress}<br>` +
               (notes ? `<strong>Notas:</strong> ${notes}<br>` : '');
      }
      
      // Si NO está asociado a un Work, mostrar tipo y método
      return `💰 <strong>Nuevo Gasto Registrado</strong><br><br>` +
             `<strong>Monto:</strong> $${amount.toFixed(2)}<br>` +
             `<strong>Tipo de Gasto:</strong> ${expenseType}<br>` +
             `<strong>Método de Pago:</strong> ${paymentMethod}<br>` +
             `<strong>Registrado por:</strong> ${staffName}<br>` +
             (notes ? `<strong>Notas:</strong> ${notes}<br>` : '') +
             `<em>(No asociado a proyecto específico)</em>`;
    }
  },
  
  incomeRegistered: {
    roles: ['owner', 'finance'],
    message: (income) => {
      const amount = parseFloat(income.amount || 0);
      const incomeType = income.typeIncome || 'Ingreso';
      const staffName = income.Staff?.name || 'Staff desconocido';
      const paymentMethod = income.paymentMethod || 'No especificado';
      const notes = income.notes || '';
      
      // Si está asociado a un Work, mostrar dirección
      if (income.work?.propertyAddress || income.propertyAddress) {
        const workAddress = income.work?.propertyAddress || income.propertyAddress;
        return `💵 <strong>Nuevo Ingreso Registrado</strong><br><br>` +
               `<strong>Monto:</strong> $${amount.toFixed(2)}<br>` +
               `<strong>Tipo:</strong> ${incomeType}<br>` +
               `<strong>Método de Pago:</strong> ${paymentMethod}<br>` +
               `<strong>Registrado por:</strong> ${staffName}<br>` +
               `<strong>Proyecto:</strong> ${workAddress}<br>` +
               (notes ? `<strong>Notas:</strong> ${notes}<br>` : '');
      }
      
      // Si NO está asociado a un Work, mostrar tipo y método
      return `💵 <strong>Nuevo Ingreso Registrado</strong><br><br>` +
             `<strong>Monto:</strong> $${amount.toFixed(2)}<br>` +
             `<strong>Tipo de Ingreso:</strong> ${incomeType}<br>` +
             `<strong>Método de Pago:</strong> ${paymentMethod}<br>` +
             `<strong>Registrado por:</strong> ${staffName}<br>` +
             (notes ? `<strong>Notas:</strong> ${notes}<br>` : '') +
             `<em>(No asociado a proyecto específico)</em>`;
    }
  },
  
  expenseUpdated: {
    roles: ['owner', 'finance'], // Solo finance, NO finance-viewer
    message: (expense) => {
      const amount = parseFloat(expense.amount || 0);
      const expenseType = expense.typeExpense || 'Gasto';
      const paymentMethod = expense.paymentMethod || 'No especificado';
      const notes = expense.notes || '';
      
      // Si está asociado a un Work
      if (expense.work?.propertyAddress || expense.propertyAddress) {
        const workAddress = expense.work?.propertyAddress || expense.propertyAddress;
        return `📝 <strong>Gasto Actualizado</strong><br><br>` +
               `<strong>Monto:</strong> $${amount.toFixed(2)}<br>` +
               `<strong>Tipo:</strong> ${expenseType}<br>` +
               `<strong>Método de Pago:</strong> ${paymentMethod}<br>` +
               `<strong>Proyecto:</strong> ${workAddress}<br>` +
               (notes ? `<strong>Notas:</strong> ${notes}<br>` : '');
      }
      
      // Si NO está asociado a un Work
      return `📝 <strong>Gasto Actualizado</strong><br><br>` +
             `<strong>Monto:</strong> $${amount.toFixed(2)}<br>` +
             `<strong>Tipo de Gasto:</strong> ${expenseType}<br>` +
             `<strong>Método de Pago:</strong> ${paymentMethod}<br>` +
             (notes ? `<strong>Notas:</strong> ${notes}<br>` : '') +
             `<em>(No asociado a proyecto específico)</em>`;
    }
  },
  workApproved: {
    roles: ['owner'], // Solo notificar al owner
    message: (work) => `El trabajo para la dirección ${work.propertyAddress || 'Dirección desconocida'} (Work ID: ${work?.idWork || work?.id || 'N/A'}) ha sido aprobado y está listo para ser agendado.`,
  },
  // ------------------ Estados faltantes agregados ------------------
  final_invoice_received: {
    roles: ['owner'],
    message: (work, context) => {
      const invoiceUrl = context?.invoiceUrl || context?.invoiceFromInspectorUrl || 'Sin URL';
      return `Se recibió la factura del inspector para la obra en ${work?.propertyAddress || 'Dirección desconocida'}. Inspección ID: ${context?.inspectionId || 'N/A'}. URL: ${invoiceUrl}`;
    }
  },
  final_invoice_sent_to_client: {
    roles: [ 'owner'],
    message: (work, context) => {
      const clientEmail = context?.clientEmail || 'cliente@desconocido';
      return `El Invoice final ha sido enviado al cliente (${clientEmail}) para la obra en ${work?.propertyAddress || 'Dirección desconocida'}. Inspección ID: ${context?.inspectionId || 'N/A'}.`;
    }
  },
  budgetSigned: {
    roles: ['admin', 'owner'],
    message: (data) => {
      const id = data?.idBudget || data?.id || 'N/A';
      const addr = data?.propertyAddress || data?.address || 'Dirección desconocida';
      const signer = data?.signedBy || data?.signedByName || 'firmante';
      return `El presupuesto #${id} para ${addr} ha sido firmado por ${signer}.`;
    }
  },
  customEmail: {
    // customEmail debe recibir { staff: [...], message: '...' }
    roles: [],
    getStaff: async (data) => {
      // Si el caller pasó un arreglo 'staff' con emails, devolverlo tal cual para notificar
      if (Array.isArray(data?.staff) && data.staff.length) {
        // Mapear al formato mínimo esperado
        return data.staff.map(s => ({ id: s.id || null, email: s.email || s, name: s.name || null, role: s.role || null, pushToken: s.pushToken || null }));
      }
      // Fallback: no staff especificado -> notificar a admin/owner
      return await Staff.findAll({ where: { role: ['owner'] } });
    },
    message: (data) => data?.message || 'Mensaje personalizado',
  },
  
  // 🆕 NOTIFICACIÓN CUANDO ALGUIEN ES MENCIONADO EN UNA NOTA
  mentionInNote: {
    roles: [], // Se define mediante getStaff
    getStaff: async (data) => {
      // data debe contener: { mentionedStaffIds: [...] }
      if (!data?.mentionedStaffIds || data.mentionedStaffIds.length === 0) {
        return [];
      }
      
      // Buscar staff por IDs mencionados
      const staff = await Staff.findAll({
        where: {
          id: data.mentionedStaffIds,
          email: { [Op.ne]: null }
        },
        attributes: ['id', 'email', 'name', 'role']
      });
      
      return staff;
    },
    message: (data) => {
      const authorName = data?.authorName || 'Alguien';
      const location = data?.location || 'un proyecto';
      const notePreview = data?.notePreview || '';
      const noteType = data?.noteType || 'nota';
      
      const typeLabel = noteType === 'budget_note' ? 'un seguimiento de presupuesto' : noteType === 'lead_note' ? 'un Sales Lead' : 'un seguimiento de obra';
      return `${authorName} te mencionó en ${typeLabel} para ${location}:\n\n"${notePreview}"`;
    },
    subject: (data) => {
      const authorName = data?.authorName || 'Alguien';
      return `${authorName} te mencionó en un seguimiento`;
    },
    // 🎨 Formato HTML personalizado para emails de menciones
    htmlTemplate: (data) => {
      const authorName = data?.authorName || 'Alguien';
      const location = data?.location || 'un proyecto';
      const notePreview = data?.notePreview || '';
      const noteType = data?.noteType || 'nota';
      const typeLabel = noteType === 'budget_note' ? '💰 Budget' : noteType === 'lead_note' ? '🎯 Sales Lead' : '🏠 Work';
      
      return `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1e90ff 0%, #0066cc 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">
              👋 Te han mencionado
            </h1>
          </div>
          
          <!-- Content -->
          <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <!-- Author Info -->
            <div style="margin-bottom: 25px;">
              <div style="display: inline-block; background: #e3f2fd; padding: 10px 20px; border-radius: 20px; margin-bottom: 15px;">
                <span style="color: #1e90ff; font-weight: 600; font-size: 16px;">👤 ${authorName}</span>
              </div>
              <p style="color: #6c757d; margin: 5px 0; font-size: 14px;">
                te mencionó en ${noteType === 'budget_note' ? 'un seguimiento de budget' : noteType === 'lead_note' ? 'un Sales Lead' : 'un seguimiento de work'}
              </p>
            </div>
            
            <!-- Project Location -->
            <div style="background: #f8f9fa; border-left: 4px solid #1e90ff; padding: 15px 20px; margin-bottom: 25px; border-radius: 4px;">
              <div style="display: flex; align-items: center;">
                <span style="font-size: 20px; margin-right: 10px;">${typeLabel}</span>
                <span style="color: #495057; font-weight: 600; font-size: 15px;">${location}</span>
              </div>
            </div>
            
            <!-- Note Preview -->
            <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border: 2px solid #1e90ff; border-radius: 12px; padding: 20px; margin-bottom: 25px; position: relative;">
              <div style="position: absolute; top: -12px; left: 20px; background: white; padding: 0 10px;">
                <span style="color: #1e90ff; font-weight: 600; font-size: 12px; text-transform: uppercase;">Mensaje</span>
              </div>
              <div style="margin-top: 8px;">
                <p style="color: #495057; font-size: 15px; line-height: 1.6; margin: 0; font-style: italic;">
                  "${notePreview}"
                </p>
              </div>
            </div>
            
            <!-- Action Button -->
            <div style="text-align: center; margin-top: 30px;">
              <a href="https://www.zurcherseptic.com" 
                 style="display: inline-block; background: linear-gradient(135deg, #1e90ff 0%, #0066cc 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 25px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 15px rgba(30, 144, 255, 0.4); transition: all 0.3s;">
                📱 Ver en la App
              </a>
            </div>
            
            <!-- Footer Note -->
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;">
              <p style="color: #6c757d; font-size: 13px; margin: 0; text-align: center;">
                💡 <strong>Tip:</strong> Responde directamente desde la app para mantener la conversación
              </p>
            </div>
          </div>
          
          <!-- Email Footer -->
          <div style="text-align: center; padding: 20px; color: #6c757d; font-size: 12px;">
            <p style="margin: 5px 0;">Zurcher Construction</p>
            <p style="margin: 5px 0;">Sistema de Gestión de Proyectos</p>
          </div>
        </div>
      `;
    }
  },

  // 🆕 Configuración para SimpleWork enviado
  simpleWorkSent: {
    roles: ['owner', 'finance'],
    subject: (work) => `SimpleWork Enviado: #${work?.workNumber || 'N/A'} - ${work?.clientData?.firstName || ''} ${work?.clientData?.lastName || ''}`,
    message: (work) => {
      const clientName = work?.clientData ? `${work.clientData.firstName || ''} ${work.clientData.lastName || ''}`.trim() : 'Cliente desconocido';
      const clientEmail = work?.clientData?.email || 'Email no especificado';
      return `El SimpleWork #${work?.workNumber || 'N/A'} ha sido enviado por email al cliente ${clientName} (${clientEmail}). El presupuesto está disponible para revisión y aprobación del cliente.`;
    }
  },
};

// Función para obtener los empleados a notificar y el mensaje
// Ahora: si el estado define `getStaff`, lo usamos (permite incluir al trabajador asignado).
// Siempre normalizamos y deduplicamos emails (lowercase + trim) y devolvemos optional `subject`.
const getNotificationDetails = async (status, work, context = {}) => {
  const notificationConfig = stateNotificationMap[status];
  if (!notificationConfig) {
    throw new Error(`Estado de notificación no configurado: ${status}`);
  }

  const roles = notificationConfig.roles || [];
  const message = typeof notificationConfig.message === 'function'
    ? notificationConfig.message(work, context)
    : (notificationConfig.message || '');

  const subject = notificationConfig.subject
    ? (typeof notificationConfig.subject === 'function' ? notificationConfig.subject(work, context) : notificationConfig.subject)
    : null;

  // 🎨 Obtener template HTML personalizado si existe
  const htmlTemplate = notificationConfig.htmlTemplate
    ? (typeof notificationConfig.htmlTemplate === 'function' ? notificationConfig.htmlTemplate : null)
    : null;

  // 1) Obtener candidatas/os desde getStaff si existe, sino por roles desde la tabla Staff
  let staffRecords = [];
  if (typeof notificationConfig.getStaff === 'function') {
    try {
      staffRecords = await notificationConfig.getStaff(work, context) || [];
    } catch (err) {
      console.error('Error ejecutando getStaff para estado', status, err);
      staffRecords = [];
    }
  } else {
    staffRecords = await Staff.findAll({
      where: {
        role: roles,
        email: { [Op.ne]: null }
      },
      attributes: ['id', 'email', 'name', 'role', 'pushToken']
    });
  }

  // 2) Normalizar y deduplicar por email (lowercase + trim)
  const byEmail = new Map();
  for (const s of (staffRecords || [])) {
    const rawEmail = (s && (s.email || s?.dataValues?.email)) || '';
    const email = String(rawEmail || '').toLowerCase().trim();
    if (!email || !email.includes('@')) continue; // saltar entradas sin email válido
    if (!byEmail.has(email)) {
      // preservar id/name/role/pushToken cuando existan
      const id = s.id || (s.dataValues && s.dataValues.id) || null;
      const name = s.name || (s.dataValues && s.dataValues.name) || null;
      const role = s.role || (s.dataValues && s.dataValues.role) || null;
      const pushToken = s.pushToken || (s.dataValues && s.dataValues.pushToken) || null;
      byEmail.set(email, { id, email, name, role, pushToken });
    }
  }

  const staffToNotify = Array.from(byEmail.values());

  return { staffToNotify, message, subject, htmlTemplate, roles }; // ✅ Incluir roles para filtrado
};

module.exports = { getNotificationDetails };