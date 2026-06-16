const { Staff } = require('../../data');
const { Op } = require('sequelize');

const getNotificationDetailsApp = async (newStatus, work, budget, context = {}) => {
    let staffToNotify = [];
    let message = '';
    const targetObject = work || budget;
    const address = targetObject?.propertyAddress || 'Dirección desconocida';

    switch (newStatus) {
        case 'budgetCreated':
            staffToNotify = await Staff.findAll({ where: { role: ['owner'] } });
            message = `El presupuesto para ${work.propertyAddress} está listo para ser enviado al cliente.`;
            break;

        case 'budgetSent':
            staffToNotify = await Staff.findAll({ where: { role: ['owner'] } });
            message = `El presupuesto para ${work.propertyAddress} ha sido enviado al cliente.`;
            break;
        case 'workApproved':
            staffToNotify = await Staff.findAll({ where: { role: ['owner'] } }); // Solo owner
            // Mensaje corto para push notification
            message = `Trabajo Aprobado: ${work.propertyAddress} listo para agendar.`;
            break;
            case 'pending': // Estado inicial del Work o cuando está listo para materiales/asignación
             // Ajusta roles según quién deba saber que está pendiente
                staffToNotify = await Staff.findAll({ where: { role: ['admin', 'owner'] } });
            message = `Trabajo Pendiente: ${address}. Comprar materiales/asignar.`;
            break;

            case 'assigned': // Cuando se asigna un staffId al Work
            if (work?.staffId) {
                const assignedStaff = await Staff.findByPk(work.staffId);
                // Obtener managers/recept con pushToken
                const managers = await Staff.findAll({
                    where: {
                        role: ['owner', 'recept'],
                        pushToken: { [Op.ne]: null } // Solo los que tienen push token
                    }
                });
                // Combinar y filtrar nulos/sin token (si assignedStaff no tiene token)
                staffToNotify = [assignedStaff?.pushToken ? assignedStaff : null, ...managers].filter(Boolean);

                // --- Mensaje mejorado ---
                const assignedName = assignedStaff?.name || `ID ${work.staffId}`;
                // Formatear la fecha de inicio si existe
                const startDateFormatted = work.startDate
                    ? new Date(work.startDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : 'fecha no definida';

                // Mensaje para push: incluye instrucción para 'recept'
                message = `Asignado: ${address} a ${assignedName}. Inicio: ${startDateFormatted}. Recept: Comprar materiales.`;
                // --- Fin Mensaje mejorado ---

            } else {
                 // Si no hay staffId, notificar a admin/owner/recept que necesita asignación
                 staffToNotify = await Staff.findAll({
                     where: {
                         role: ['owner','recept'],
                         pushToken: { [Op.ne]: null } // Solo con pushToken
                     }
                 });
                 message = `Asignación Pendiente: ${address}.`;
            }
            break;

        case 'inProgress': // Cuando se compran materiales o empieza el trabajo
             // Notificar a roles relevantes (worker asignado, admin, owner?)
             staffToNotify = await Staff.findAll({ where: { role: ['recept', 'owner',] } }); // Ajusta roles
             message = `Trabajo en Progreso: ${address}.`;
             break;

        case 'installed':
             // Notificar a roles relevantes para solicitar inspección
             staffToNotify = await Staff.findAll({ where: { role: [ 'admin', 'owner'] } });
             message = `Trabajo Instalado: ${address}. Solicitar 1ra inspección.`;
             break;
           case 'firstInspectionPending':
               staffToNotify = await Staff.findAll({ where: { role: ['admin', 'owner'] } });
               message = `Inspección inicial solicitada: ${address}.`;
               break;
        case 'coverPending':
                // Notificar a roles relevantes para solicitar inspección
                staffToNotify = await Staff.findAll({ where: { role: ['worker', 'admin', 'owner'] } });
                message = `Inspeccion Aprobada, listo para cubrir en la direccion: ${address}. Avisar cuando este Tapado.`;
                break;
        case 'covered':
                    // Notificar a roles relevantes para solicitar inspección
                    staffToNotify = await Staff.findAll({ where: { role: [ 'admin', 'owner'] } });
                    message = `Trabajo Tapado: ${address}. Solicitar inspección Final.`;
                    break;
        case 'invoiceFinal':
                    // Notificar cuando se envía la factura final
                    staffToNotify = await Staff.findAll({ where: { role: [ 'admin', 'owner'] } });
                    message = `Invoice Final enviado para: ${address}. Esperando pago del cliente.`;
                    break;
        case 'finalInspectionPending':
                    staffToNotify = await Staff.findAll({ where: { role: ['admin', 'owner'] } });
                    message = `Inspección final solicitada: ${address}.`;
                    break;
        case 'final_inspection_requested':
                    staffToNotify = await Staff.findAll({ where: { role: ['admin', 'owner'] } });
                    message = `Inspección final solicitada al inspector: ${address}.`;
                    break;
        case 'final_invoice_sent_to_client':
                    staffToNotify = await Staff.findAll({ where: { role: ['admin', 'owner'] } });
                    message = `Invoice final enviado al cliente para: ${address}.`;
                    break;
        case 'final_payment_confirmed_by_client':
                    staffToNotify = await Staff.findAll({ where: { role: ['admin', 'owner'] } });
                    message = `Pago final confirmado por el cliente para: ${address}.`;
                    break;

        // --- Añade CASES para TODOS los demás estados de Work ---
        // firstInspectionPending, approvedInspection, rejectedInspection,
        // completed, finalInspectionPending, finalApproved, finalRejected, maintenance

        // Ejemplo para completed:
        case 'completed':
             staffToNotify = await Staff.findAll({ where: { role: ['owner', 'admin'] } });
             message = `Trabajo Completado: ${address}. Revisar estado final.`;
             break;


             default:
                // Estado no configurado para push notifications
                return { staffToNotify: [], message: '' };
        }
    
    // Deduplicar por pushToken o id para evitar push duplicados
    const byTokenOrId = new Map();
    for (const s of (staffToNotify || [])) {
        const key = s.pushToken || s.id;
        if (key && !byTokenOrId.has(key)) {
            byTokenOrId.set(key, s);
        }
    }
    
    const deduplicatedStaff = Array.from(byTokenOrId.values());
    
    // Asegúrate de devolver siempre la misma estructura
    return { staffToNotify: deduplicatedStaff, message };
};
module.exports = { getNotificationDetailsApp };