const { Work, MaintenanceVisit, MaintenanceMedia, Staff, Permit } = require('../data');
const { uploadBufferToCloudinary, deleteFromCloudinary } = require('../utils/cloudinaryUploader');
const cloudinary = require('cloudinary').v2;
const { Op } = require('sequelize');
const { addMonths, format, parseISO  } = require('date-fns'); // Para manipulación de fechas
const jwt = require('jsonwebtoken');
const { generateMaintenancePDF } = require('../utils/maintenancePdfGenerator');
const { sendEmail } = require('../utils/notifications/emailService');
const fs = require('fs');
const path = require('path');

// --- Lógica para Programar Mantenimientos Iniciales ---
const scheduleInitialMaintenanceVisits = async (workId) => {
  try {
    const work = await Work.findByPk(workId);

    if (!work) {
      console.error(`[MaintenanceController - scheduleInitial] Work ${workId} NOT FOUND. Cannot schedule visits.`);
      return;
    }

    if (work.status !== 'maintenance') {
      console.warn(`[MaintenanceController - scheduleInitial] Work ${workId} is not in 'maintenance' status (current: ${work.status}). Skipping visit scheduling.`);
      return;
    }
 if (!work.maintenanceStartDate) { // Esta condición ahora es menos probable que se cumpla si WorkController lo hizo bien
      console.error(`[MaintenanceController - scheduleInitial] Work ${workId} is in 'maintenance' but has NO maintenanceStartDate...`);
      return; 
    }

    const existingVisitsCount = await MaintenanceVisit.count({ where: { workId } });


    if (existingVisitsCount > 0) {

      return;
    }

   // Manejar maintenanceStartDate como Date o string para evitar errores
   console.log(`[MaintenanceController - scheduleInitial] DEBUG: maintenanceStartDate type=${typeof work.maintenanceStartDate}, value=${work.maintenanceStartDate}, instanceof Date=${work.maintenanceStartDate instanceof Date}`);
   
   let baseDate;
   if (work.maintenanceStartDate instanceof Date) {
     baseDate = work.maintenanceStartDate;
   } else {
     // Si es string, intentar parsearlo
     const dateStr = String(work.maintenanceStartDate);

     if (dateStr.includes('T')) {
       // Ya tiene formato ISO completo
       baseDate = new Date(dateStr);

     } else {
       // Formato YYYY-MM-DD, agregar hora
       baseDate = parseISO(dateStr + 'T12:00:00');

     }
   }
   
   // Verificar si la fecha es válida antes de usar toISOString
   if (isNaN(baseDate.getTime())) {
     console.error(`[MaintenanceController - scheduleInitial] INVALID DATE: baseDate=${baseDate}, original=${work.maintenanceStartDate}`);
     return;
   }
   


    for (let i = 1; i <= 4; i++) {
       const scheduledDateForVisit = addMonths(baseDate, i * 6); 
      // --- FIN DEL CAMBIO ---
      
      const formattedScheduledDate = format(scheduledDateForVisit, 'yyyy-MM-dd');
      

      
      const newVisit = await MaintenanceVisit.create({
        workId,
        visitNumber: i,
        scheduledDate: formattedScheduledDate,
        status: 'pending_scheduling',
      });

    }


  } catch (error) {
    console.error(`[MaintenanceController - scheduleInitial] CRITICAL ERROR scheduling visits for workId ${workId}:`, error);
  }
};

// --- Obtener todas las visitas de mantenimiento para una obra ---
const getMaintenanceVisitsForWork = async (req, res) => {
  try {
    const { workId } = req.params;
    const visits = await MaintenanceVisit.findAll({
      where: { workId },
      include: [
        { model: MaintenanceMedia, as: 'mediaFiles' },
        { model: Staff, as: 'assignedStaff', attributes: ['id', 'name', 'email'] }, // Incluir datos del staff asignado
        { 
          model: Work, 
          as: 'work',
          include: [
            { 
              model: Permit, 
              attributes: [
                'idPermit', 'permitNumber', 'expirationDate', 'systemType', 
                'applicantName', 'applicantEmail', 'applicantPhone',
                'propertyAddress', 
                'pdfData', 'optionalDocs', // Legacy Buffer fields
                'permitPdfUrl', 'permitPdfPublicId', 'optionalDocsUrl', 'optionalDocsPublicId', // ✅ Cloudinary URLs
                'gpdCapacity', 'squareFeetSystem', 'pump'
              ]
            }
          ]
        }
      ],
      order: [['visitNumber', 'ASC']],
    });
    // if (!visits || visits.length === 0) {
    //   return res.status(404).json({ message: 'No se encontraron visitas de mantenimiento para esta obra.' });
    // }
    res.status(200).json(visits);
  } catch (error) {
    console.error('Error al obtener visitas de mantenimiento:', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor.' });
  }
};

// --- Actualizar una visita de mantenimiento (registrar fecha, notas, estado) ---
const updateMaintenanceVisit = async (req, res) => {
  try {
    const { visitId } = req.params;
    // Destructuring all potential fields from req.body
    // workId is received but generally not used to modify the visit's own workId.
    const { actualVisitDate, notes, status, staffId, scheduledDate, workId: receivedWorkId } = req.body;

    const visit = await MaintenanceVisit.findByPk(visitId);
    if (!visit) {
      return res.status(404).json({ error: true, message: 'Visita de mantenimiento no encontrada.' });
    }

    // Update fields if they were provided in the request body
    if (actualVisitDate !== undefined) {
        // Ensure actualVisitDate is null if an empty string is sent, or a valid date
        visit.actualVisitDate = actualVisitDate === '' ? null : actualVisitDate;
    }
    if (notes !== undefined) {
        visit.notes = notes;
    }
    if (status !== undefined) {
        visit.status = status; // Status is determined by frontend logic
    }
    if (scheduledDate !== undefined) { // For rescheduling
        visit.scheduledDate = scheduledDate; // Frontend sends 'yyyy-MM-dd'
    }
    
    // Track if staff assignment changed for email notification
    const previousStaffId = visit.staffId;
    const staffAssignmentChanged = req.body.hasOwnProperty('staffId') && previousStaffId !== staffId;
    const scheduledDateChanged = req.body.hasOwnProperty('scheduledDate') && scheduledDate !== undefined;
    
    // Handle staffId: allows assigning a new staff, or unassigning (setting to null)
    // if 'staffId' is explicitly part of the request body.
    if (req.body.hasOwnProperty('staffId')) {
        visit.staffId = staffId; // staffId can be a UUID or null
    }

    await visit.save();

    // Optional: Logic for 4th visit completion
    if (visit.visitNumber === 4 && visit.status === 'completed') {
      const work = await Work.findByPk(visit.workId); // visit.workId is the correct FK
      if (work) {

        // Example: work.status = 'maintenance_completed';
        // await work.save();
      }
    }

    // Refetch the updated visit to include associations for the response
    const updatedVisit = await MaintenanceVisit.findByPk(visitId, {
        include: [
        { model: MaintenanceMedia, as: 'mediaFiles' }, // Good to keep for consistency
        { model: Staff, as: 'assignedStaff', attributes: ['id', 'name', 'email'] }, // Crucial for frontend update
        { 
          model: Work, 
          as: 'work',
          attributes: ['idWork', 'propertyAddress'],
          include: [
            { 
              model: Permit, 
              attributes: ['permitNumber', 'systemType', 'applicantName', 'pdfData', 'optionalDocs']
            }
          ]
        }
      ]});

    // Send email notification if staff was assigned or if date changed for existing assignment
    const shouldSendEmail = (staffAssignmentChanged && staffId) || (scheduledDateChanged && visit.staffId);
    
    if (shouldSendEmail && updatedVisit.assignedStaff) {
      try {
        const staff = updatedVisit.assignedStaff;
        const work = updatedVisit.work;
        const permit = work?.Permit;
        
        const scheduledDateFormatted = updatedVisit.scheduledDate 
          ? new Date(updatedVisit.scheduledDate + 'T12:00:00').toLocaleDateString('es-ES', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })
          : 'Por programar';

        // Preparar attachments con los PDFs del permiso
        const emailAttachments = [];
        
        if (permit?.pdfData) {
          emailAttachments.push({
            filename: `Permiso_${permit.permitNumber || 'Principal'}.pdf`,
            content: Buffer.isBuffer(permit.pdfData) ? permit.pdfData : Buffer.from(permit.pdfData, 'base64'),
            contentType: 'application/pdf'
          });
        }
        
        if (permit?.optionalDocs) {
          if (Buffer.isBuffer(permit.optionalDocs)) {
            emailAttachments.push({
              filename: `Documentacion_Adicional.pdf`,
              content: permit.optionalDocs,
              contentType: 'application/pdf'
            });
          } else if (typeof permit.optionalDocs === 'string') {
            emailAttachments.push({
              filename: `Documentacion_Adicional.pdf`,
              content: Buffer.from(permit.optionalDocs, 'base64'),
              contentType: 'application/pdf'
            });
          }
        }

        const emailSubject = `Nueva Visita de Mantenimiento Asignada - ${work?.propertyAddress || 'Obra'}`;
        const emailText = `Hola ${staff.name},\n\nSe te ha asignado una nueva visita de mantenimiento:\n\n` +
          `📍 Dirección: ${work?.propertyAddress || 'N/A'}\n` +
          `🔢 Visita #${updatedVisit.visitNumber}\n` +
          `📅 Fecha programada: ${scheduledDateFormatted}\n` +
          `📋 Estado: ${updatedVisit.status === 'scheduled' ? 'Programada' : updatedVisit.status === 'assigned' ? 'Asignada' : 'Pendiente'}\n` +
          (permit?.permitNumber ? `🎫 Permiso: ${permit.permitNumber}\n` : '') +
          (permit?.systemType ? `🔧 Sistema: ${permit.systemType}\n` : '') +
          (permit?.applicantName ? `👤 Cliente: ${permit.applicantName}\n` : '') +
          (updatedVisit.notes ? `\n📝 Notas: ${updatedVisit.notes}\n` : '') +
          `\nPor favor, revisa los detalles en la aplicación móvil.\n\nSaludos.`;

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
            <h2 style="color: #1a365d; border-bottom: 3px solid #1a365d; padding-bottom: 10px;">
              🔧 Nueva Visita de Mantenimiento Asignada
            </h2>
            <p>Hola <strong>${staff.name}</strong>,</p>
            <p>Se te ha asignado una nueva visita de mantenimiento:</p>
            
            <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #718096;"><strong>📍 Dirección:</strong></td>
                  <td style="padding: 8px 0;">${work?.propertyAddress || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #718096;"><strong>🔢 Visita:</strong></td>
                  <td style="padding: 8px 0;">#${updatedVisit.visitNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #718096;"><strong>📅 Fecha programada:</strong></td>
                  <td style="padding: 8px 0;"><strong style="color: #2d3748;">${scheduledDateFormatted}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #718096;"><strong>📋 Estado:</strong></td>
                  <td style="padding: 8px 0;">
                    <span style="background: #4299e1; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">
                      ${updatedVisit.status === 'scheduled' ? 'Programada' : updatedVisit.status === 'assigned' ? 'Asignada' : 'Pendiente'}
                    </span>
                  </td>
                </tr>
                ${permit?.permitNumber ? `
                <tr>
                  <td style="padding: 8px 0; color: #718096;"><strong>🎫 Permiso:</strong></td>
                  <td style="padding: 8px 0;">${permit.permitNumber}</td>
                </tr>` : ''}
                ${permit?.systemType ? `
                <tr>
                  <td style="padding: 8px 0; color: #718096;"><strong>🔧 Sistema:</strong></td>
                  <td style="padding: 8px 0;">${permit.systemType}</td>
                </tr>` : ''}
                ${permit?.applicantName ? `
                <tr>
                  <td style="padding: 8px 0; color: #718096;"><strong>👤 Cliente:</strong></td>
                  <td style="padding: 8px 0;">${permit.applicantName}</td>
                </tr>` : ''}
              </table>
            </div>
            
            ${updatedVisit.notes ? `
            <div style="background: #fff5e6; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>📝 Notas:</strong></p>
              <p style="margin: 10px 0 0 0;">${updatedVisit.notes}</p>
            </div>` : ''}
            
            ${emailAttachments.length > 0 ? `
            <div style="background: #e6f7ff; border-left: 4px solid #1890ff; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>📎 Documentos adjuntos:</strong></p>
              <p style="margin: 10px 0 0 0;">Se han adjuntado los documentos del permiso para tu referencia.</p>
            </div>` : ''}
            
            <p style="margin-top: 30px;">Por favor, revisa los detalles en la <strong>aplicación móvil</strong>.</p>
            <p style="color: #718096; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              Saludos,<br>
              <strong>Sistema de Mantenimiento</strong>
            </p>
          </div>
        `;

        // Enviar email de forma asíncrona (no esperar)
        sendEmail({
          to: staff.email,
          subject: emailSubject,
          text: emailText,
          html: emailHtml,
          attachments: emailAttachments,
        }).then(() => {

        }).catch((emailError) => {
          console.error('❌ Error al enviar email de asignación:', emailError);
        });


      } catch (emailError) {
        console.error('❌ Error preparando email de asignación:', emailError);
        // No fallar la request si el email falla
      }
    }

    // Responder inmediatamente sin esperar el email
    res.status(200).json({ message: 'Visita de mantenimiento actualizada.', visit: updatedVisit });
  } catch (error) {
    console.error('❌ Error al actualizar visita de mantenimiento:', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor.', details: error.message });
  }
};

// --- Añadir media (imágenes/videos) a una visita de mantenimiento ---
const addMediaToMaintenanceVisit = async (req, res) => {
  try {
    const { visitId } = req.params;
    const files = req.files; // Array de archivos de Multer

    const visit = await MaintenanceVisit.findByPk(visitId);
    if (!visit) {
      return res.status(404).json({ error: true, message: 'Visita de mantenimiento no encontrada.' });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ error: true, message: 'No se proporcionaron archivos.' });
    }

    const uploadedMedia = [];
    for (const file of files) {
      const resourceType = file.mimetype.startsWith('video/') ? 'video' : (file.mimetype.startsWith('image/') ? 'image' : 'raw');
      const cloudinaryResult = await uploadBufferToCloudinary(file.buffer, {
        folder: `maintenance/${visit.workId}/${visit.id}`,
        resource_type: resourceType,
      });

      const newMedia = await MaintenanceMedia.create({
        maintenanceVisitId: visit.id,
        mediaUrl: cloudinaryResult.secure_url,
        publicId: cloudinaryResult.public_id,
        mediaType: resourceType === 'raw' ? 'document' : resourceType, // Ajustar 'raw' a 'document'
        originalName: file.originalname,
      });
      uploadedMedia.push(newMedia);
    }
    
    const updatedVisit = await MaintenanceVisit.findByPk(visitId, {
        include: [{ model: MaintenanceMedia, as: 'mediaFiles' }]
    });

    res.status(201).json({ message: `${uploadedMedia.length} archivo(s) añadido(s) a la visita.`, visit: updatedVisit, addedMedia: uploadedMedia });
  } catch (error) {
    console.error('Error al añadir media a la visita de mantenimiento:', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor.' });
  }
};

// --- Eliminar media de una visita de mantenimiento ---
const deleteMaintenanceMedia = async (req, res) => {
    try {
        const { mediaId } = req.params;
        const media = await MaintenanceMedia.findByPk(mediaId, {
            include: [
                {
                    model: MaintenanceVisit,
                    as: 'maintenanceVisit',
                    attributes: ['id', 'staffId', 'completed_by_staff_id']
                }
            ]
        });

        if (!media) {
            return res.status(404).json({ error: true, message: 'Archivo multimedia no encontrado.' });
        }

        // Verificar permisos: admin/owner/maintenance pueden eliminar cualquier foto
        // Workers solo pueden eliminar fotos de sus propias visitas asignadas
        const currentUserId = req.staff?.id;
        const userRole = req.staff?.rol || req.staff?.role;
        
        const isAdminOrOwner = ['admin', 'owner', 'maintenance'].includes(userRole?.toLowerCase());
        const isAssignedWorker = media.maintenanceVisit && (
            media.maintenanceVisit.staffId === currentUserId || 
            media.maintenanceVisit.completed_by_staff_id === currentUserId
        );

        if (!isAdminOrOwner && !isAssignedWorker) {
            return res.status(403).json({ 
                error: true, 
                message: 'No tienes permiso para eliminar esta foto.' 
            });
        }

        if (media.publicId) {
            await deleteFromCloudinary(media.publicId);
        }
        await media.destroy();

        res.status(200).json({ message: 'Archivo multimedia eliminado correctamente.' });
    } catch (error) {
        console.error('Error al eliminar archivo multimedia de mantenimiento:', error);
        res.status(500).json({ error: true, message: 'Error interno del servidor.' });
    }
};


// --- Programar visitas de mantenimiento manualmente ---
const scheduleMaintenanceVisits = async (req, res) => {
  try {
    const { workId } = req.params;
    const { startDate, forceReschedule } = req.body; // Agregar flag para forzar reprogramación
    
    const work = await Work.findByPk(workId, {
      attributes: ['idWork', 'maintenanceStartDate'] // Solo traer campos necesarios
    });
    if (!work) {
      return res.status(404).json({ error: true, message: 'Obra no encontrada.' });
    }

    // Variables para tracking
    let visitsToDelete = [];
    let visitsToPreserve = [];
    
    // Verificar si ya existen visitas (SIN incluir media para performance)
    const existingVisits = await MaintenanceVisit.findAll({ 
      where: { workId },
      attributes: ['id', 'visitNumber', 'status', 'actualVisitDate'],
      include: [{ 
        model: MaintenanceMedia, 
        as: 'mediaFiles',
        attributes: ['id'], // Solo necesitamos saber si existen
        required: false
      }]
    });
    
    if (existingVisits.length > 0) {
      if (!forceReschedule) {
        return res.status(400).json({ 
          error: true, 
          message: 'Ya existen visitas programadas para esta obra. Use forceReschedule=true para reprogramar.',
          existingVisits: existingVisits.length 
        });
      }
      
      // Si forceReschedule es true, identificar qué visitas se pueden eliminar
      for (const visit of existingVisits) {
        // Preservar visitas que tienen:
        // 1. Estado completado u omitido
        // 2. Fotos/documentos subidos
        // 3. Fecha de visita real registrada
        const hasMedia = visit.mediaFiles && visit.mediaFiles.length > 0;
        const isCompleted = visit.status === 'completed' || visit.status === 'skipped';
        const hasActualDate = visit.actualVisitDate !== null;
        
        if (hasMedia || isCompleted || hasActualDate) {
          visitsToPreserve.push(visit);

        } else {
          visitsToDelete.push(visit.id);
        }
      }
      
      // Eliminar solo las visitas sin datos importantes
      if (visitsToDelete.length > 0) {
        await MaintenanceVisit.destroy({ 
          where: { 
            id: visitsToDelete 
          } 
        });

      }
      
      if (visitsToPreserve.length > 0) {

      }
    }

    // Usar la fecha proporcionada o la fecha actual
    // Usar parseISO para evitar problemas de timezone con strings YYYY-MM-DD
    const baseDate = startDate ? parseISO(startDate + 'T12:00:00') : new Date();
    
    // Obtener números de visitas ya existentes (preservadas) DESPUÉS de eliminar
    const preservedVisits = await MaintenanceVisit.findAll({
      where: { workId },
      attributes: ['visitNumber'],
      order: [['visitNumber', 'ASC']],
      raw: true
    });
    const existingNumbers = preservedVisits.map(v => v.visitNumber);

    
    // Crear las 4 visitas de mantenimiento (solo las que no existen)
    // ✅ Usar bulkCreate en lugar de crear una por una (1 query en lugar de 4)
    const visitsToCreate = [];
    for (let i = 1; i <= 4; i++) {
      // Si ya existe una visita con este número, saltarla
      if (existingNumbers.includes(i)) {

        continue;
      }
      
      const scheduledDateForVisit = addMonths(baseDate, i * 6);
      const formattedScheduledDate = format(scheduledDateForVisit, 'yyyy-MM-dd');
      
      visitsToCreate.push({
        workId,
        visitNumber: i,
        scheduledDate: formattedScheduledDate,
        status: 'pending_scheduling',
      });
    }
    
    // ✅ Crear todas las visitas en una sola query
    const visits = visitsToCreate.length > 0 
      ? await MaintenanceVisit.bulkCreate(visitsToCreate)
      : [];
    
    if (visits.length > 0) {
      console.log(`✅ Creadas ${visits.length} visitas en una sola operación`);
    }

    // Actualizar la fecha de inicio de mantenimiento en la obra si se proporcionó
    if (startDate && !work.maintenanceStartDate) {
      work.maintenanceStartDate = startDate;
      await work.save();
    }

    // Obtener todas las visitas actualizadas (SIN mediaFiles para mejor performance)
    const allVisits = await MaintenanceVisit.findAll({
      where: { workId },
      include: [
        { model: Staff, as: 'assignedStaff', attributes: ['id', 'name', 'email'] }
      ],
      order: [['visitNumber', 'ASC']]
    });

    const responseMessage = visits.length > 0 
      ? `Se ${existingVisits.length > 0 ? 'reprogramaron' : 'programaron'} ${visits.length} visita(s) de mantenimiento.`
      : 'No se crearon nuevas visitas (todas ya existían).';

    res.status(201).json({ 
      message: responseMessage,
      visitsCreated: visits.length,
      visitsPreserved: visitsToPreserve.length,
      visitsDeleted: visitsToDelete.length,
      allVisits: allVisits,
      work: work,
      rescheduled: existingVisits.length > 0
    });
  } catch (error) {
    console.error('❌ Error al programar visitas de mantenimiento:', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor.', details: error.message });
  }
};

// --- Inicializar mantenimiento histórico para obras antiguas ---
const initializeHistoricalMaintenance = async (req, res) => {
  try {
    const { workId } = req.params;
    const { completionDate, generatePastVisits } = req.body;
    
    const work = await Work.findByPk(workId);
    if (!work) {
      return res.status(404).json({ error: true, message: 'Obra no encontrada.' });
    }

    // Verificar si ya existen visitas
    const existingVisitsCount = await MaintenanceVisit.count({ where: { workId } });
    if (existingVisitsCount > 0) {
      return res.status(400).json({ 
        error: true, 
        message: 'Ya existen visitas para esta obra. Use la función de reprogramar en su lugar.' 
      });
    }

    const completionDateObj = new Date(completionDate);
    const currentDate = new Date();
    
    // Calcular cuántas visitas deberían haber ocurrido
    const monthsSinceCompletion = Math.floor(
      (currentDate - completionDateObj) / (1000 * 60 * 60 * 24 * 30)
    );
    const visitsDue = Math.min(Math.floor(monthsSinceCompletion / 6), 4);
    
    const visits = [];
    
    // Si generatePastVisits es true, crear visitas históricas como "overdue"
    if (generatePastVisits && visitsDue > 0) {
      for (let i = 1; i <= visitsDue; i++) {
        const scheduledDateForVisit = addMonths(completionDateObj, i * 6);
        const formattedScheduledDate = format(scheduledDateForVisit, 'yyyy-MM-dd');
        
        const newVisit = await MaintenanceVisit.create({
          workId,
          visitNumber: i,
          scheduledDate: formattedScheduledDate,
          status: 'overdue', // Estado especial para visitas vencidas
        });
        visits.push(newVisit);
      }
    }
    
    // Crear las visitas futuras restantes
    const remainingVisits = 4 - visitsDue;
    for (let i = visitsDue + 1; i <= 4; i++) {
      const scheduledDateForVisit = addMonths(completionDateObj, i * 6);
      const formattedScheduledDate = format(scheduledDateForVisit, 'yyyy-MM-dd');
      
      const newVisit = await MaintenanceVisit.create({
        workId,
        visitNumber: i,
        scheduledDate: formattedScheduledDate,
        status: 'pending_scheduling',
      });
      visits.push(newVisit);
    }

    // Actualizar la fecha de inicio de mantenimiento en la obra
    work.maintenanceStartDate = completionDate;
    await work.save();

    res.status(201).json({ 
      message: 'Mantenimiento histórico inicializado correctamente.', 
      visits,
      work: work,
      visitsDue,
      overdueVisits: generatePastVisits ? visitsDue : 0
    });
  } catch (error) {
    console.error('Error al inicializar mantenimiento histórico:', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor.' });
  }
};

// --- Crear una visita individual ---
const createMaintenanceVisit = async (req, res) => {
  try {
    const { workId } = req.params;
    const { scheduledDate, visitNumber, notes, assignedStaffId } = req.body;
    const currentUserId = req.staff.id; // Usuario que está creando la visita
    
    const work = await Work.findByPk(workId);
    if (!work) {
      return res.status(404).json({ error: true, message: 'Obra no encontrada.' });
    }

    // Verificar si ya existe una visita con ese número
    if (visitNumber) {
      const existingVisit = await MaintenanceVisit.findOne({ 
        where: { workId, visitNumber } 
      });
      if (existingVisit) {
        return res.status(400).json({ 
          error: true, 
          message: `Ya existe una visita con el número ${visitNumber}.` 
        });
      }
    }

    // Determinar quién será asignado a la visita
    let finalAssignedStaffId = assignedStaffId;
    
    if (assignedStaffId) {
      // Si se proporcionó un staff específico, verificar que existe
      const staffMember = await Staff.findByPk(assignedStaffId);
      if (!staffMember) {
        return res.status(400).json({ 
          error: true, 
          message: 'El miembro del staff seleccionado no existe.' 
        });
      }
    } else {
      // Si no se proporcionó staff, usar el usuario actual
      finalAssignedStaffId = currentUserId;
    }

    // Calcular el siguiente número de visita si no se proporciona
    const maxVisitNumber = await MaintenanceVisit.max('visitNumber', { where: { workId } }) || 0;
    const nextVisitNumber = visitNumber || (maxVisitNumber + 1);

    const newVisit = await MaintenanceVisit.create({
      workId,
      visitNumber: nextVisitNumber,
      scheduledDate: scheduledDate || null,
      assignedStaffId: finalAssignedStaffId,
      status: 'pending_scheduling',
      notes: notes || null,
    });

    // Obtener la visita creada con las asociaciones
    const createdVisit = await MaintenanceVisit.findByPk(newVisit.id, {
      include: [
        { model: MaintenanceMedia, as: 'mediaFiles' },
        { model: Staff, as: 'assignedStaff', attributes: ['id', 'name', 'email'] },
        { 
          model: Work, 
          as: 'work',
          attributes: ['idWork', 'propertyAddress'],
          include: [
            { 
              model: Permit, 
              attributes: ['permitNumber', 'systemType', 'applicantName', 'pdfData', 'optionalDocs']
            }
          ]
        }
      ]
    });

    // Send email notification to assigned staff
    if (finalAssignedStaffId && createdVisit.assignedStaff) {
      try {
        const staff = createdVisit.assignedStaff;
        const workData = createdVisit.work;
        const permit = workData?.Permit;
        
        const scheduledDateFormatted = createdVisit.scheduledDate 
          ? new Date(createdVisit.scheduledDate + 'T12:00:00').toLocaleDateString('es-ES', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })
          : 'Por programar';

        // Preparar attachments con los PDFs del permiso
        const emailAttachments = [];
        
        if (permit?.pdfData) {
          emailAttachments.push({
            filename: `Permiso_${permit.permitNumber || 'Principal'}.pdf`,
            content: Buffer.isBuffer(permit.pdfData) ? permit.pdfData : Buffer.from(permit.pdfData, 'base64'),
            contentType: 'application/pdf'
          });
        }
        
        if (permit?.optionalDocs) {
          if (Buffer.isBuffer(permit.optionalDocs)) {
            emailAttachments.push({
              filename: `Documentacion_Adicional.pdf`,
              content: permit.optionalDocs,
              contentType: 'application/pdf'
            });
          } else if (typeof permit.optionalDocs === 'string') {
            emailAttachments.push({
              filename: `Documentacion_Adicional.pdf`,
              content: Buffer.from(permit.optionalDocs, 'base64'),
              contentType: 'application/pdf'
            });
          }
        }

        const emailSubject = `Nueva Visita de Mantenimiento Asignada - ${workData?.propertyAddress || 'Obra'}`;
        const emailText = `Hola ${staff.name},\n\nSe te ha asignado una nueva visita de mantenimiento:\n\n` +
          `📍 Dirección: ${workData?.propertyAddress || 'N/A'}\n` +
          `🔢 Visita #${createdVisit.visitNumber}\n` +
          `📅 Fecha programada: ${scheduledDateFormatted}\n` +
          `📋 Estado: Pendiente de programar\n` +
          (permit?.permitNumber ? `🎫 Permiso: ${permit.permitNumber}\n` : '') +
          (permit?.systemType ? `🔧 Sistema: ${permit.systemType}\n` : '') +
          (permit?.applicantName ? `👤 Cliente: ${permit.applicantName}\n` : '') +
          (createdVisit.notes ? `\n📝 Notas: ${createdVisit.notes}\n` : '') +
          `\nPor favor, revisa los detalles en la aplicación móvil.\n\nSaludos.`;

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
            <h2 style="color: #1a365d; border-bottom: 3px solid #1a365d; padding-bottom: 10px;">
              🔧 Nueva Visita de Mantenimiento Asignada
            </h2>
            <p>Hola <strong>${staff.name}</strong>,</p>
            <p>Se te ha asignado una nueva visita de mantenimiento:</p>
            
            <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #718096;"><strong>📍 Dirección:</strong></td>
                  <td style="padding: 8px 0;">${workData?.propertyAddress || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #718096;"><strong>🔢 Visita:</strong></td>
                  <td style="padding: 8px 0;">#${createdVisit.visitNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #718096;"><strong>📅 Fecha programada:</strong></td>
                  <td style="padding: 8px 0;"><strong style="color: #2d3748;">${scheduledDateFormatted}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #718096;"><strong>📋 Estado:</strong></td>
                  <td style="padding: 8px 0;">
                    <span style="background: #718096; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">
                      Pendiente de programar
                    </span>
                  </td>
                </tr>
                ${permit?.permitNumber ? `
                <tr>
                  <td style="padding: 8px 0; color: #718096;"><strong>🎫 Permiso:</strong></td>
                  <td style="padding: 8px 0;">${permit.permitNumber}</td>
                </tr>` : ''}
                ${permit?.systemType ? `
                <tr>
                  <td style="padding: 8px 0; color: #718096;"><strong>🔧 Sistema:</strong></td>
                  <td style="padding: 8px 0;">${permit.systemType}</td>
                </tr>` : ''}
                ${permit?.applicantName ? `
                <tr>
                  <td style="padding: 8px 0; color: #718096;"><strong>👤 Cliente:</strong></td>
                  <td style="padding: 8px 0;">${permit.applicantName}</td>
                </tr>` : ''}
              </table>
            </div>
            
            ${createdVisit.notes ? `
            <div style="background: #fff5e6; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>📝 Notas:</strong></p>
              <p style="margin: 10px 0 0 0;">${createdVisit.notes}</p>
            </div>` : ''}
            
            ${emailAttachments.length > 0 ? `
            <div style="background: #e6f7ff; border-left: 4px solid #1890ff; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>📎 Documentos adjuntos:</strong></p>
              <p style="margin: 10px 0 0 0;">Se han adjuntado los documentos del permiso para tu referencia.</p>
            </div>` : ''}
            
            <p style="margin-top: 30px;">Por favor, revisa los detalles en la <strong>aplicación móvil</strong>.</p>
            <p style="color: #718096; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              Saludos,<br>
              <strong>Sistema de Mantenimiento</strong>
            </p>
          </div>
        `;

        await sendEmail({
          to: staff.email,
          subject: emailSubject,
          text: emailText,
          html: emailHtml,
          attachments: emailAttachments,
        });

      } catch (emailError) {
        console.error('❌ Error al enviar email de asignación:', emailError);
        // No fallar la request si el email falla
      }
    }

    res.status(201).json({ 
      message: 'Visita de mantenimiento creada correctamente.', 
      visit: createdVisit,
      assignedToCurrentUser: !assignedStaffId // Indicar si se asignó al usuario actual
    });
  } catch (error) {
    console.error('Error al crear visita de mantenimiento:', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor.' });
  }
};

// --- Obtener mantenimientos asignados a un worker específico ---
const getAssignedMaintenances = async (req, res) => {
  try {
    const { workerId } = req.query;
    const userRole = req.user?.role;
    const isPrivileged = ['capataz', 'admin', 'owner'].includes(userRole);

    if (!workerId && !isPrivileged) {
      return res.status(400).json({ error: true, message: 'Se requiere workerId.' });
    }

    console.log(`[getAssignedMaintenances] Fetching for workerId: ${workerId || 'ALL (capataz/admin/owner)'}`);

    const whereClause = workerId ? { staffId: workerId } : {};

    // ✅ OPTIMIZACIÓN: Usar JOIN directo en lugar de query separada
    const visitsRaw = await MaintenanceVisit.findAll({
      where: whereClause,
      attributes: { 
        exclude: [] // Traer todos los campos de MaintenanceVisit
      },
      include: [
        { 
          model: Staff, 
          as: 'assignedStaff', 
          attributes: ['id', 'name', 'email'] 
        },
        { 
          model: Work, 
          as: 'work', 
          attributes: ['idWork', 'status', 'maintenanceStartDate', 'propertyAddress'],
          include: [
            {
              model: Permit,
              attributes: [
                'idPermit', 'propertyAddress', 'applicant', 'applicantName', 
                'systemType', 'permitNumber',
                // Solo URLs, no buffers
                'permitPdfUrl', 'permitPdfPublicId', 'optionalDocsUrl', 'optionalDocsPublicId'
              ]
            }
          ]
        }
      ],
      order: [['scheduledDate', 'ASC']],
      limit: 200 // Limitar resultados para evitar timeouts
    });

    console.log(`[getAssignedMaintenances] Found ${visitsRaw.length} visits`);

    // DEBUG: Ver estructura de la primera visita
    if (visitsRaw.length > 0) {
      const firstVisitRaw = visitsRaw[0].get({ plain: true });
      console.log('🔍 [DEBUG] Estructura primera visita:', {
        id: firstVisitRaw.id,
        workId: firstVisitRaw.workId,
        hasWork: !!firstVisitRaw.work,
        hasWorkCapital: !!firstVisitRaw.Work,
        workKeys: firstVisitRaw.work ? Object.keys(firstVisitRaw.work) : null,
        WorkKeys: firstVisitRaw.Work ? Object.keys(firstVisitRaw.Work) : null
      });
    }

    // Convertir a objetos planos
    const visits = visitsRaw.map(v => {
      const visit = v.get({ plain: true });
      
      // DEBUG: Acceder tanto con 'work' como con 'Work'
      const workLower = visit.work || null;
      const workUpper = visit.Work || null;
      const work = workLower || workUpper;
      
      // Acceso directo al Permit desde Work
      const permit = work?.Permit || null;
      
      // Mantener compatibilidad con múltiples formatos
      if (work) {
        visit.work = work;
        visit.Work = work;
        work.permit = permit;
        work.Permit = permit;
      }
      
      // Extraer información de zona
      const address = permit?.propertyAddress || work?.propertyAddress || '';
      
      // DEBUG: Log para ver qué dirección se está usando
      if (!address) {
        console.log(`⚠️ [getAssignedMaintenances] Visita ${visit.id} sin dirección:`, {
          permitPropertyAddress: permit?.propertyAddress,
          workPropertyAddress: work?.propertyAddress,
          hasPermit: !!permit,
          hasWork: !!work
        });
      }
      
      // ZIP code (5 dígitos)
      const zipMatch = address.match(/\b\d{5}\b/);
      visit.extractedZipCode = zipMatch ? zipMatch[0] : null;
      
      // City - extracción mejorada
      let city = null;
      if (address) {
        // Normalizar dirección para búsqueda
        const normalizedAddress = address.toLowerCase().replace(/\s+/g, ' ').trim();
        
        // Lista de palabras clave de ciudades conocidas
        const cityKeywords = [
          'lehigh acres', 'lehigh', 'cape coral', 'fort myers', 'ft myers',
          'north port', 'port charlotte', 'la belle', 'labelle',
          'deltona', 'poinciana', 'orlando'
        ];
        
        // Buscar coincidencias en el orden de prioridad (más específico primero)
        for (const keyword of cityKeywords) {
          if (normalizedAddress.includes(keyword)) {
            city = keyword;
            break;
          }
        }
        
        // Si no se encuentra keyword, intentar extracción por comas
        if (!city) {
          const parts = address.split(',').map(p => p.trim());
          if (parts.length >= 2) {
            city = parts[parts.length - 2].toLowerCase();
          }
        }
      }
      visit.extractedCity = city;
      visit.fullAddress = address;
      
      // Calcular días hasta visita
      const scheduledDate = new Date(visit.scheduledDate);
      scheduledDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      visit.daysUntilVisit = Math.floor((scheduledDate - today) / (1000 * 60 * 60 * 24));
      visit.isOverdue = visit.daysUntilVisit < 0;

      return visit;
    });

    // Ordenar: vencidas primero
    visits.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return a.daysUntilVisit - b.daysUntilVisit;
    });

    console.log(`[getAssignedMaintenances] Returning ${visits.length} visits (${visits.filter(v => v.isOverdue).length} overdue)`);

    res.status(200).json({ 
      message: 'Mantenimientos asignados obtenidos correctamente.', 
      visits, 
      count: visits.length 
    });
  } catch (error) {
    console.error('[getAssignedMaintenances] Error:', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor.' });
  }
};

// --- Generar token de corta duración para acceso al formulario ---
const generateMaintenanceToken = async (req, res) => {
  try {
    const { visitId } = req.params;
    const currentUserId = req.staff?.id;

    const visit = await MaintenanceVisit.findByPk(visitId, {
      include: [
        { 
          model: Staff, 
          as: 'assignedStaff', 
          attributes: ['id', 'name', 'email'] 
        }
      ]
    });

    if (!visit) {
      return res.status(404).json({ error: true, message: 'Visita de mantenimiento no encontrada.' });
    }

    // Verificar permisos: solo el worker asignado o admin/owner/maintenance pueden generar token
    const userRole = req.staff?.role; // ✅ Corregido: 'role' no 'rol'
    const isAuthorized = 
      visit.staffId === currentUserId || // ✅ Corregido: usar staffId que es el campo correcto
      ['admin', 'owner', 'maintenance'].includes(userRole);

    if (!isAuthorized) {
      return res.status(403).json({ error: true, message: 'No autorizado para generar token para esta visita.' });
    }

    // Generar token JWT de corta duración (15 minutos)
    const token = jwt.sign(
      {
        visitId: visit.id,
        staffId: visit.staffId,
        type: 'maintenance_form'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '15m' }
    );

    res.status(200).json({ 
      message: 'Token generado correctamente.',
      token,
      visitId: visit.id,
      expiresIn: 900 // 15 minutos en segundos
    });
  } catch (error) {
    console.error('Error al generar token de mantenimiento:', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor.' });
  }
};

// --- Completar formulario de mantenimiento ---
const completeMaintenanceVisit = async (req, res) => {
  try {
    const { visitId } = req.params;
    const files = req.files; // Objeto con arrays por fieldname cuando usamos upload.fields()
    const currentUserId = req.staff?.id;

    // Extraer todos los campos del formulario
    const {
      // Fecha de la visita
      actualVisitDate,
      
      // Niveles del tanque
      tank_inlet_level,
      tank_inlet_notes,
      tank_outlet_level,
      tank_outlet_notes,
      
      // Niveles (legacy - mantener por compatibilidad)
      level_inlet,
      level_outlet,
      
      // Inspección General
      strong_odors,
      strong_odors_notes,
      water_level_ok,
      water_level_notes,
      visible_leaks,
      visible_leaks_notes,
      area_around_dry,
      area_around_notes,
      septic_access_clear,
      septic_access_notes,
      cap_green_inspected,
      cap_green_notes,
      needs_pumping,
      needs_pumping_notes,
      
      // Sistema ATU
      blower_working,
      blower_working_notes,
      blower_filter_clean,
      blower_filter_notes,
      diffusers_bubbling,
      diffusers_bubbling_notes,
      discharge_pump_ok,
      discharge_pump_notes,
      clarified_water_outlet,
      clarified_water_notes,
      alarm_test,
      alarm_test_notes,
      
      // Lift Station
      pump_running,
      pump_running_notes,
      float_switches,
      float_switches_notes,
      alarm_working,
      alarm_working_notes,
      pump_condition,
      pump_condition_notes,
      alarm_panel_working,
      alarm_panel_notes,
      pump_working,
      pump_working_notes,
      float_switch_good,
      float_switch_notes,
      
      // PBTS
      well_samples, // JSON string
      
      // PBTS/ATU - Nuevos campos
      well_points_quantity,
      well_sample_1_observations,
      well_sample_1_notes,
      well_sample_2_observations,
      well_sample_2_notes,
      well_sample_3_observations,
      well_sample_3_notes,
      
      // Lift Station - Opcionales
      has_lift_station,
      
      // PBTS - Opcionales
      has_pbts,
      
      // VIDEO
      system_video_url,
      
      // Generales
      general_notes,
      markAsCompleted, // Indica si se debe cambiar el estado a 'completed'
      
      // Archivos asociados a campos específicos (JSON string con mapeo)
      fileFieldMapping, // Ej: {"file1.jpg": "strong_odors", "file2.mp4": "general"}
    } = req.body;

    const visit = await MaintenanceVisit.findByPk(visitId);
    if (!visit) {
      return res.status(404).json({ error: true, message: 'Visita de mantenimiento no encontrada.' });
    }

    // Verificar permisos
    const userRole = req.staff?.rol || req.staff?.role; // ✅ Soportar ambos: 'rol' y 'role'
    const isAuthorized = 
      visit.staffId === currentUserId || 
      ['admin', 'owner', 'maintenance', 'worker'].includes(userRole?.toLowerCase());

    if (!isAuthorized) {
      return res.status(403).json({ error: true, message: 'No autorizado para completar esta visita.' });
    }

    // Actualizar campos del formulario
    // Niveles del tanque (nuevos campos)
    visit.tank_inlet_level = tank_inlet_level || null;
    visit.tank_inlet_notes = tank_inlet_notes || null;
    visit.tank_outlet_level = tank_outlet_level || null;
    visit.tank_outlet_notes = tank_outlet_notes || null;
    
    // Niveles legacy (mantener por compatibilidad)
    visit.level_inlet = level_inlet || tank_inlet_level || null;
    visit.level_outlet = level_outlet || tank_outlet_level || null;
    
    // Inspección General
    visit.strong_odors = strong_odors === 'true' || strong_odors === true;
    visit.strong_odors_notes = strong_odors_notes || null;
    visit.water_level_ok = water_level_ok === 'true' || water_level_ok === true;
    visit.water_level_notes = water_level_notes || null;
    visit.visible_leaks = visible_leaks === 'true' || visible_leaks === true;
    visit.visible_leaks_notes = visible_leaks_notes || null;
    visit.area_around_dry = area_around_dry === 'true' || area_around_dry === true;
    visit.area_around_notes = area_around_notes || null;
    visit.septic_access_clear = septic_access_clear === 'true' || septic_access_clear === true || septic_access_clear === 'SI';
    visit.septic_access_notes = septic_access_notes || null;
    visit.cap_green_inspected = cap_green_inspected === 'true' || cap_green_inspected === true || cap_green_inspected === 'SI';
    visit.cap_green_notes = cap_green_notes || null;
    visit.needs_pumping = needs_pumping === 'true' || needs_pumping === true || needs_pumping === 'SI';
    visit.needs_pumping_notes = needs_pumping_notes || null;
    
    // Sistema ATU
    visit.blower_working = blower_working === 'true' || blower_working === true;
    visit.blower_working_notes = blower_working_notes || null;
    visit.blower_filter_clean = blower_filter_clean === 'true' || blower_filter_clean === true;
    visit.blower_filter_notes = blower_filter_notes || null;
    visit.diffusers_bubbling = diffusers_bubbling === 'true' || diffusers_bubbling === true;
    visit.diffusers_bubbling_notes = diffusers_bubbling_notes || null;
    visit.discharge_pump_ok = discharge_pump_ok === 'true' || discharge_pump_ok === true || discharge_pump_ok === 'SI';
    visit.discharge_pump_notes = discharge_pump_notes || null;
    visit.clarified_water_outlet = clarified_water_outlet === 'true' || clarified_water_outlet === true;
    visit.clarified_water_notes = clarified_water_notes || null;
    visit.alarm_test = alarm_test === 'true' || alarm_test === true || alarm_test === 'SI';
    visit.alarm_test_notes = alarm_test_notes || null;
    
    // Lift Station - OPCIONALES
    console.log('🔍 BACKEND - has_lift_station recibido:', has_lift_station, 'tipo:', typeof has_lift_station);
    visit.has_lift_station = has_lift_station === 'true' || has_lift_station === true;
    console.log('🔍 BACKEND - has_lift_station guardado:', visit.has_lift_station);
    visit.pump_running = pump_running === 'true' || pump_running === true || pump_running === 'SI';
    visit.pump_running_notes = pump_running_notes || null;
    visit.float_switches = float_switches === 'true' || float_switches === true || float_switches === 'SI';
    visit.float_switches_notes = float_switches_notes || null;
    visit.alarm_working = alarm_working === 'true' || alarm_working === true || alarm_working === 'SI';
    visit.alarm_working_notes = alarm_working_notes || null;
    visit.pump_condition = pump_condition === 'true' || pump_condition === true || pump_condition === 'SI';
    visit.pump_condition_notes = pump_condition_notes || null;
    visit.alarm_panel_working = alarm_panel_working === 'true' || alarm_panel_working === true;
    visit.alarm_panel_notes = alarm_panel_notes || null;
    visit.pump_working = pump_working === 'true' || pump_working === true;
    visit.pump_working_notes = pump_working_notes || null;
    visit.float_switch_good = float_switch_good === 'true' || float_switch_good === true;
    visit.float_switch_notes = float_switch_notes || null;
    
    // PBTS - OPCIONALES
    console.log('🔍 BACKEND - has_pbts recibido:', has_pbts, 'tipo:', typeof has_pbts);
    visit.has_pbts = has_pbts === 'true' || has_pbts === true;
    console.log('🔍 BACKEND - has_pbts guardado:', visit.has_pbts);
    
    // PBTS - parsear JSON
    if (well_samples) {
      try {
        visit.well_samples = typeof well_samples === 'string' ? JSON.parse(well_samples) : well_samples;
      } catch (e) {
        console.error('Error parsing well_samples:', e);
        visit.well_samples = [];
      }
    }
    
    // PBTS/ATU - Cantidad de well points
    if (well_points_quantity) {
      visit.well_points_quantity = parseInt(well_points_quantity, 10);
    }
    
    // PBTS - Observaciones y notas adicionales
    visit.well_sample_1_observations = well_sample_1_observations || null;
    visit.well_sample_1_notes = well_sample_1_notes || null;
    visit.well_sample_2_observations = well_sample_2_observations || null;
    visit.well_sample_2_notes = well_sample_2_notes || null;
    visit.well_sample_3_observations = well_sample_3_observations || null;
    visit.well_sample_3_notes = well_sample_3_notes || null;
    
    // Video del sistema
    visit.system_video_url = system_video_url || null;
    
    visit.general_notes = general_notes || null;
    
    // Solo marcar como completado si se indica explícitamente
    if (markAsCompleted === 'true' || markAsCompleted === true) {
      // Usar la fecha seleccionada por el usuario, o la fecha actual si no se proporcionó
      visit.actualVisitDate = actualVisitDate || new Date().toISOString().split('T')[0];
      visit.status = 'completed';
      visit.completed_by_staff_id = currentUserId;
    } else {
      // Guardar progreso sin completar - guardar la fecha si se proporcionó
      if (actualVisitDate) {
        visit.actualVisitDate = actualVisitDate;
      }
      if (visit.status === 'pending_scheduling' || visit.status === 'scheduled') {
        visit.status = 'assigned'; // Cambiar a 'en proceso'
      }
    }

    await visit.save();

    // ✅ Preservar URLs existentes de muestras PBTS y final_system_image si se envían (sin archivos nuevos)
    const {
      well_sample_1_url: existingSample1Url,
      well_sample_2_url: existingSample2Url,
      well_sample_3_url: existingSample3Url,
      final_system_image_url: existingFinalImageUrl
    } = req.body;
    
    if (existingSample1Url) {
      visit.well_sample_1_url = existingSample1Url;
    }
    if (existingSample2Url) {
      visit.well_sample_2_url = existingSample2Url;
    }
    if (existingSample3Url) {
      visit.well_sample_3_url = existingSample3Url;
    }
    if (existingFinalImageUrl) {
      visit.final_system_image_url = existingFinalImageUrl;
    }

    // ✅ Procesar imágenes de muestras PBTS/ATU en background
    const sampleFields = ['wellSample1', 'wellSample2', 'wellSample3'];
    const sampleUploads = [];
    
    for (let i = 0; i < sampleFields.length; i++) {
      const fieldName = sampleFields[i];
      const fileArray = files?.[fieldName];
      
      if (fileArray && fileArray.length > 0) {
        const file = fileArray[0];
        const urlField = `well_sample_${i + 1}_url`;
        
        // ✅ Subir en background
        sampleUploads.push(
          uploadBufferToCloudinary(file.buffer, {
            folder: `maintenance/${visit.workId}/${visit.id}/well_samples`,
            resource_type: 'image',
          })
            .then((cloudinaryResult) => {
              visit[urlField] = cloudinaryResult.secure_url;
              return visit.save();
            })
            .catch((error) => {
              console.error(`❌ Error subiendo muestra ${i + 1}:`, error);
            })
        );
      }
    }
    
    // ✅ Esperar solo si hay muestras (son rápidas, no videos pesados)
    if (sampleUploads.length > 0) {
      await Promise.all(sampleUploads);
    }

    // ✅ Procesar video del sistema ANTES de guardar (para asegurar que se guarde el URL)
    const systemVideoArray = files?.systemVideo;
    console.log('🎬 DEBUG - systemVideoArray:', systemVideoArray ? `${systemVideoArray.length} archivo(s)` : 'undefined');
    
    if (systemVideoArray && systemVideoArray.length > 0) {
      const videoFile = systemVideoArray[0];
      const videoSize = Math.round(videoFile.size / 1024 / 1024);
      console.log(`🎬 Subiendo video del sistema: ${videoFile.originalname} (${videoSize}MB)`);
      
      try {
        // 🚀 COMPRESIÓN AUTOMÁTICA EN CLOUDINARY
        const compressionOptions = {
          folder: `maintenance/${visit.workId}/${visit.id}/system_video`,
          resource_type: 'video',
          // 📹 TRANSFORMACIONES DE COMPRESIÓN
          transformation: [
            {
              // Calidad automática optimizada
              quality: 'auto:good',
              // Formato más eficiente (auto-selecciona mejor formato)
              fetch_format: 'auto',
              // Compresión adicional
              flags: 'lossy'
            }
          ]
        };

        // Si el video es muy grande (>15MB), aplicar compresión más agresiva
        if (videoSize > 15) {
          console.log(`🎯 Video grande (${videoSize}MB), aplicando compresión agresiva y procesamiento asíncrono`);
          compressionOptions.eager_async = true; //  Procesar transformaciones de forma asíncrona
          compressionOptions.transformation.push({
            // Reducir resolución si es necesario
            width: 1280,
            height: 720,
            crop: 'limit',
            // Calidad más conservadora
            quality: 'auto:low',
            // Bitrate reducido
            bit_rate: '1000k'
          });
        }
        
        // ✅ AWAIT para asegurar que se guarde el URL antes de responder
        const cloudinaryResult = await uploadBufferToCloudinary(videoFile.buffer, compressionOptions);
        
        visit.system_video_url = cloudinaryResult.secure_url;
        
        // 📊 Información de compresión
        const originalSizeMB = Math.round(videoFile.size / 1024 / 1024);
        const compressedSizeKB = Math.round(cloudinaryResult.bytes / 1024);
        const compressedSizeMB = (cloudinaryResult.bytes / 1024 / 1024).toFixed(2);
        const compressionRatio = ((1 - cloudinaryResult.bytes / videoFile.size) * 100).toFixed(1);
        
        console.log('✅ Video del sistema cargado y comprimido:', {
          url: cloudinaryResult.secure_url,
          originalSize: `${originalSizeMB}MB`,
          compressedSize: compressedSizeKB < 1024 ? `${compressedSizeKB}KB` : `${compressedSizeMB}MB`,
          compressionRatio: `${compressionRatio}%`,
          format: cloudinaryResult.format
        });
        
      } catch (error) {
        console.error('❌ Error subiendo video del sistema:', error);
        // No fallar todo el proceso si el video falla
      }
    } else {
      console.log('⚠️ No se recibió video del sistema en esta llamada');
    }

    // ✅ GUARDAR EN DB con el URL del video
    await visit.save();
    
    // 🆕 Procesar imagen final del sistema (OBLIGATORIA)
    const finalSystemImageArray = files?.finalSystemImage;
    console.log('📸 DEBUG - finalSystemImageArray:', finalSystemImageArray ? `${finalSystemImageArray.length} archivo(s)` : 'undefined');
    
    if (finalSystemImageArray && finalSystemImageArray.length > 0) {
      const imageFile = finalSystemImageArray[0];
      const imageSize = Math.round(imageFile.size / 1024);
      console.log(`📸 Subiendo imagen final del sistema: ${imageFile.originalname} (${imageSize}KB)`);
      
      try {
        // 🚀 COMPRESIÓN AUTOMÁTICA DE IMAGEN
        const compressionOptions = {
          folder: `maintenance/${visit.workId}/${visit.id}/final_system`,
          resource_type: 'image',
          // 📸 TRANSFORMACIONES DE COMPRESIÓN
          transformation: [
            {
              // Calidad optimizada automáticamente
              quality: 'auto:good',
              // Formato más eficiente
              fetch_format: 'auto',
              // Compresión inteligente
              flags: 'progressive'
            }
          ]
        };

        // Si la imagen es muy grande (>1MB), aplicar más compresión
        if (imageSize > 1024) {
          console.log(`🎯 Imagen grande (${imageSize}KB), aplicando compresión agresiva`);
          compressionOptions.transformation.push({
            // Limitar resolución máxima
            width: 1920,
            height: 1080,
            crop: 'limit',
            // Calidad más conservadora
            quality: 'auto:eco'
          });
        }
        
        const cloudinaryResult = await uploadBufferToCloudinary(imageFile.buffer, compressionOptions);
        
        visit.final_system_image_url = cloudinaryResult.secure_url;
        await visit.save();
        
        // 📊 Información de compresión
        const originalSizeKB = Math.round(imageFile.size / 1024);
        const compressedSizeKB = Math.round(cloudinaryResult.bytes / 1024);
        const compressionRatio = ((1 - cloudinaryResult.bytes / imageFile.size) * 100).toFixed(1);
        
        console.log('✅ Imagen final del sistema optimizada:', {
          url: cloudinaryResult.secure_url,
          originalSize: `${originalSizeKB}KB`,
          compressedSize: `${compressedSizeKB}KB`,
          compressionRatio: `${compressionRatio}%`,
          format: cloudinaryResult.format
        });
        
      } catch (error) {
        console.error('❌ Error subiendo imagen final del sistema:', error);
      }
    } else if (markAsCompleted === 'true' || markAsCompleted === true) {
      // ⚠️ Si se está completando pero no hay imagen, advertir
      console.warn('⚠️ ADVERTENCIA: Se completó el mantenimiento sin imagen final del sistema');
    }

    // Procesar archivos subidos (maintenanceFiles)
    const uploadedMedia = [];
    const maintenanceFiles = files?.maintenanceFiles || []; // Extraer array de maintenanceFiles
    
    // Parsear el mapeo de archivos enviado desde el frontend (objeto: índice -> fieldName)
    let parsedFileMapping = {};
    try {
      parsedFileMapping = fileFieldMapping ? JSON.parse(fileFieldMapping) : {};
    } catch (e) {
      console.error('❌ Error parseando fileFieldMapping:', e);
    }
    
    console.log('📸 Archivos recibidos:', maintenanceFiles.length);
    console.log('📸 fileFieldMapping:', parsedFileMapping);
    
    if (maintenanceFiles.length > 0) {
      for (let i = 0; i < maintenanceFiles.length; i++) {
        const file = maintenanceFiles[i];
        // ✅ Obtener el fieldName del mapping usando el ÍNDICE en lugar del nombre
        // Esto evita colisiones cuando hay múltiples archivos con el mismo nombre
        const fieldName = parsedFileMapping[i] || parsedFileMapping[file.originalname] || 'general';
        
        // 🆕 Generar nombre único para evitar duplicados
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(7);
        const fileExtension = file.originalname.split('.').pop();
        const baseFileName = file.originalname.replace(/\.[^/.]+$/, ''); // Sin extensión
        const uniqueOriginalName = `${baseFileName}_${timestamp}_${i}_${randomSuffix}.${fileExtension}`;
        
        console.log(`📸 Procesando archivo ${i + 1}/${maintenanceFiles.length}: ${file.originalname} -> ${uniqueOriginalName} -> campo: ${fieldName}`);
        
        const resourceType = file.mimetype.startsWith('video/') ? 'video' : (file.mimetype.startsWith('image/') ? 'image' : 'raw');
        const originalSize = Math.round(file.size / 1024); // KB
        console.log(`📦 Subiendo ${resourceType}: ${uniqueOriginalName} (${originalSize}KB)`);
        
        // 🚀 CONFIGURAR COMPRESIÓN SEGÚN TIPO DE ARCHIVO
        let uploadOptions = {
          folder: `maintenance/${visit.workId}/${visit.id}`,
          resource_type: resourceType,
        };

        // 📸 COMPRESIÓN PARA IMÁGENES
        if (resourceType === 'image') {
          uploadOptions.transformation = [
            {
              // Calidad automática optimizada
              quality: 'auto:good',
              // Formato más eficiente
              fetch_format: 'auto',
              // Compresión progresiva
              flags: 'progressive'
            }
          ];

          // Si la imagen es grande (>500KB), aplicar más compresión
          if (originalSize > 500) {
            console.log(`🎯 Imagen grande (${originalSize}KB), aplicando compresión agresiva`);
            uploadOptions.transformation.push({
              // Limitar resolución para fotos de campo
              width: 1600,
              height: 1200,
              crop: 'limit',
              // Calidad más conservadora
              quality: 'auto:eco'
            });
          }
        }
        
        // 🎬 COMPRESIÓN PARA VIDEOS
        else if (resourceType === 'video') {
          uploadOptions.transformation = [
            {
              // Calidad automática para videos
              quality: 'auto:good',
              // Formato eficiente
              fetch_format: 'auto',
              // Compresión
              flags: 'lossy'
            }
          ];

          // Si el video es grande (>10MB), aplicar más compresión
          if (originalSize > 10240) { // 10MB en KB
            console.log(`🎯 Video grande (${Math.round(originalSize/1024)}MB), aplicando compresión agresiva y procesamiento asíncrono`);
            uploadOptions.eager_async = true; // 🔥 Procesar transformaciones de forma asíncrona
            uploadOptions.transformation.push({
              // Limitar resolución
              width: 1280,
              height: 720,
              crop: 'limit',
              // Reducir bitrate
              bit_rate: '800k'
            });
          }
        }
        
        const cloudinaryResult = await uploadBufferToCloudinary(file.buffer, uploadOptions);

        // 📊 Log de compresión
        const compressedSizeKB = Math.round(cloudinaryResult.bytes / 1024);
        const compressionRatio = ((1 - cloudinaryResult.bytes / file.size) * 100).toFixed(1);
        
        console.log(`✅ ${resourceType} optimizado:`, {
          originalSize: `${originalSize}KB`,
          compressedSize: `${compressedSizeKB}KB`,
          compressionRatio: `${compressionRatio}%`,
          format: cloudinaryResult.format
        });

        // La deduplicación ahora solo detectará duplicados REALES (mismo timestamp + índice + random)
        const newMedia = await MaintenanceMedia.create({
          maintenanceVisitId: visit.id,
          mediaUrl: cloudinaryResult.secure_url,
          publicId: cloudinaryResult.public_id,
          mediaType: resourceType === 'raw' ? 'document' : resourceType,
          originalName: uniqueOriginalName, // 🆕 Usar el nombre único
          fieldName: fieldName,
        });
        uploadedMedia.push(newMedia);
        console.log(`✅ Archivo guardado: ${uniqueOriginalName} en campo ${fieldName}`);
      }
    }

    // Obtener la visita actualizada con todas las relaciones
    const updatedVisit = await MaintenanceVisit.findByPk(visitId, {
      include: [
        { model: MaintenanceMedia, as: 'mediaFiles' },
        { model: Staff, as: 'assignedStaff', attributes: ['id', 'name', 'email'] },
        {
          model: Work,
          as: 'work',
          include: [
            {
              model: Permit,
              attributes: [
                'idPermit', 'permitNumber', 'expirationDate', 'systemType',
                'applicantName', 'applicantEmail', 'applicantPhone',
                'propertyAddress', 
                'pdfData', 'optionalDocs', // Legacy Buffer fields
                'permitPdfUrl', 'permitPdfPublicId', 'optionalDocsUrl', 'optionalDocsPublicId', // ✅ Cloudinary URLs
                'gpdCapacity', 'squareFeetSystem', 'pump', 'isPBTS'
              ]
            }
          ]
        }
      ]
    });

    const isCompleted = visit.status === 'completed';
    const message = isCompleted 
      ? 'Mantenimiento completado correctamente.' 
      : 'Progreso de mantenimiento guardado exitosamente.';

    console.log('✅ BACKEND - Enviando respuesta:', {
      message,
      visitId: updatedVisit.id,
      status: updatedVisit.status,
      actualVisitDate: updatedVisit.actualVisitDate,
      mediaFilesCount: updatedVisit.mediaFiles?.length || 0,
      uploadedFilesNow: uploadedMedia.length,
      systemVideoUrl: updatedVisit.system_video_url // ✅ Agregar para debug
    });

    res.status(200).json({ 
      message,
      visit: updatedVisit,
      uploadedFiles: uploadedMedia.length,
      status: visit.status,
      isCompleted
    });
  } catch (error) {
    console.error('Error al completar formulario de mantenimiento:', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor.' });
  }
};

// --- Obtener todas las visitas completadas (para Owner/Admin) ---
const getAllCompletedMaintenances = async (req, res) => {
  try {
    const { status, workId, startDate, endDate } = req.query;

    const whereClause = {};
    
    // ✅ Filtrar por estado(s) - puede ser un estado o múltiples separados por coma
    if (status && status !== 'all') {
      // Si contiene comas, dividir en array
      if (status.includes(',')) {
        const statusArray = status.split(',').map(s => s.trim());
        whereClause.status = { [Op.in]: statusArray };
      } else {
        whereClause.status = status;
      }
    }
    // Si status es 'all' o undefined, NO filtramos por status (devolvemos todas)

    // Filtrar por work específico
    if (workId) {
      whereClause.workId = workId;
    }

    // Filtrar por rango de fechas
    if (startDate || endDate) {
      whereClause.actualVisitDate = {};
      if (startDate) {
        whereClause.actualVisitDate[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        whereClause.actualVisitDate[Op.lte] = new Date(endDate);
      }
    }

    const visits = await MaintenanceVisit.findAll({
      where: whereClause,
      include: [
        { model: MaintenanceMedia, as: 'mediaFiles' },
        { 
          model: Staff, 
          as: 'assignedStaff', 
          attributes: ['id', 'name', 'email'] 
        },
        {
          model: Staff,
          as: 'completedByStaff',
          attributes: ['id', 'name', 'email']
        },
        {
          model: Work,
          as: 'work',
          attributes: ['idWork', 'status', 'propertyAddress', 'maintenanceStartDate'],
          include: [
            {
              model: Permit,
              attributes: [
                'idPermit', 'permitNumber', 'systemType',
                'applicantName', 'applicantEmail', 'applicantPhone',
                'propertyAddress', 'pdfData', 'optionalDocs', 'isPBTS'
              ]
            }
          ]
        }
      ],
      order: [['actualVisitDate', 'DESC']],
    });

    res.status(200).json({
      message: 'Visitas obtenidas correctamente',
      visits,
      count: visits.length
    });
  } catch (error) {
    console.error('Error al obtener visitas completadas:', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor.' });
  }
};

// ===== GENERAR Y DESCARGAR PDF DE VISITA DE MANTENIMIENTO =====
const downloadMaintenancePDF = async (req, res) => {
  try {
    const { visitId } = req.params;
    console.log(`📄 Generando PDF para visita: ${visitId}`);

    // Obtener datos completos de la visita
    const visit = await MaintenanceVisit.findByPk(visitId, {
      include: [
        {
          model: Work,
          as: 'work',
          include: [
            {
              model: Permit
            }
          ]
        },
        {
          model: Staff,
          as: 'assignedStaff',
          attributes: ['id', 'name', 'email']
        },
        {
          model: Staff,
          as: 'completedByStaff',
          attributes: ['id', 'name', 'email']
        },
        {
          model: MaintenanceMedia,
          as: 'mediaFiles'
        }
      ]
    });

    if (!visit) {
      return res.status(404).json({ error: true, message: 'Visita de mantenimiento no encontrada.' });
    }

    // Verificar permisos: worker asignado, completador, o admin/owner
    const currentUserId = req.staff?.id;
    const userRole = req.staff?.rol || req.staff?.role; // Puede ser 'rol' o 'role'
    
    console.log('🔍 DEBUG PDF Download:');
    console.log('  Current User ID:', currentUserId);
    console.log('  User Role:', userRole);
    console.log('  Visit Staff ID:', visit.staffId);
    console.log('  Completed By Staff ID:', visit.completed_by_staff_id);
    
    const isAuthorized = 
      visit.staffId === currentUserId || 
      visit.completed_by_staff_id === currentUserId ||
      ['admin', 'owner', 'maintenance', 'worker'].includes(userRole?.toLowerCase());

    if (!isAuthorized) {
      console.log('❌ Acceso denegado para usuario:', currentUserId, 'con rol:', userRole);
      return res.status(403).json({ 
        error: true, 
        message: 'No tienes permiso para descargar este reporte.' 
      });
    }

    console.log('✅ Acceso autorizado para usuario:', currentUserId, 'con rol:', userRole);

    // PERMITIR descargar PDF aunque no esté completada (para preview)
    // Solo advertir si no está completada
    if (visit.status !== 'completed') {
      console.log(`⚠️ Generando PDF de visita en progreso (status: ${visit.status})`);
    }

    // Generar el PDF (acepta ?lang=en|es)
    const visitJSON = visit.toJSON();
    const lang = (req.query.lang || 'es').toString();
    const pdfPath = await generateMaintenancePDF(visitJSON, lang);

    // Verificar que el archivo existe
    if (!fs.existsSync(pdfPath)) {
      console.error('❌ El archivo PDF no se generó correctamente');
      return res.status(500).json({ error: true, message: 'Error al generar el PDF.' });
    }

    // Enviar el archivo
    // Nombre de archivo más descriptivo y localizado
    const safeAddress = (visit.work?.propertyAddress || 'unknown').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const prefix = lang === 'es' ? 'Mantenimiento' : 'Maintenance';
    const fileName = `${prefix}_N${visit.visitNumber || visit.visit_number || visitId}_${safeAddress}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);

    // Eliminar el archivo después de enviarlo (opcional)
    fileStream.on('end', () => {
      setTimeout(() => {
        try {
          if (fs.existsSync(pdfPath)) {
            fs.unlinkSync(pdfPath);
            console.log(`🗑️ Archivo temporal eliminado: ${pdfPath}`);
          }
        } catch (err) {
          console.error('Error al eliminar archivo temporal:', err);
        }
      }, 1000); // Esperar 1 segundo antes de eliminar
    });

  } catch (error) {
    console.error('❌ Error al generar PDF de mantenimiento:', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor al generar PDF.' });
  }
};

// ⭐ Subir imagen individual (autoguardado progresivo)
const uploadMaintenanceImage = async (req, res) => {
  try {
    const { visitId } = req.params;
    const files = req.files || [];
    const fileFieldMapping = req.body.fileFieldMapping ? JSON.parse(req.body.fileFieldMapping) : {};
    const directFieldName = req.body.fieldName; // 🆕 Aceptar fieldName directo desde la cola

    console.log(`📸 [uploadMaintenanceImage] Subiendo ${files.length} imagen(es) para visita ${visitId}`);

    if (files.length === 0) {
      return res.status(400).json({ error: true, message: 'No se recibieron archivos.' });
    }

    // Verificar que la visita existe
    const visit = await MaintenanceVisit.findByPk(visitId);
    if (!visit) {
      return res.status(404).json({ error: true, message: 'Visita de mantenimiento no encontrada.' });
    }

    const uploadedMedia = [];

    for (const file of files) {
      try {
        console.log(`📤 Procesando archivo: ${file.originalname}`);
        
        // Subir a Cloudinary
        const result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              resource_type: 'auto',
              folder: `maintenance/${visitId}`,
              public_id: `${Date.now()}_${file.originalname.replace(/\.[^/.]+$/, '')}`,
              transformation: [
                { quality: 'auto:good' },
                { fetch_format: 'auto' }
              ]
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          uploadStream.end(file.buffer);
        });

        console.log(`✅ Archivo subido a Cloudinary: ${result.secure_url}`);

        // 🆕 Determinar fieldName: priorizar fieldName directo, luego mapping, luego 'general'
        const fieldName = directFieldName || fileFieldMapping[file.originalname] || 'general';

        // Guardar en base de datos
        const mediaRecord = await MaintenanceMedia.create({
          maintenanceVisitId: visitId,
          mediaUrl: result.secure_url,
          publicId: result.public_id,
          mediaType: result.resource_type,
          fieldName: fieldName,
          originalName: file.originalname,
          uploadedAt: new Date()
        });

        uploadedMedia.push({
          id: mediaRecord.id,
          mediaUrl: result.secure_url,
          mediaType: result.resource_type,
          fieldName: fieldName,
          originalName: file.originalname
        });

        console.log(`💾 Media guardado en DB: ID ${mediaRecord.id}, fieldName: ${fieldName}`);
      } catch (uploadError) {
        console.error(`❌ Error subiendo ${file.originalname}:`, uploadError);
        // Continuar con los demás archivos
      }
    }

    console.log(`✅ [uploadMaintenanceImage] ${uploadedMedia.length}/${files.length} archivos subidos exitosamente`);

    res.status(200).json({
      message: `${uploadedMedia.length} imagen(es) subida(s) exitosamente.`,
      uploadedMedia,
      visitId
    });
  } catch (error) {
    console.error('❌ Error en uploadMaintenanceImage:', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor.' });
  }
};

// ⭐ Obtener detalles completos de una visita específica (incluyendo mediaFiles)
const getMaintenanceVisitDetails = async (req, res) => {
  try {
    const { visitId } = req.params;
    
    const visit = await MaintenanceVisit.findByPk(visitId, {
      include: [
        { model: MaintenanceMedia, as: 'mediaFiles' },
        { model: Staff, as: 'assignedStaff', attributes: ['id', 'name', 'email'] },
        {
          model: Work,
          as: 'work',
          include: [
            {
              model: Permit,
              attributes: [
                'idPermit', 'permitNumber', 'expirationDate', 'systemType',
                'applicantName', 'applicantEmail', 'applicantPhone',
                'propertyAddress',
                'permitPdfUrl', 'permitPdfPublicId', 'optionalDocsUrl', 'optionalDocsPublicId',
                'gpdCapacity', 'squareFeetSystem', 'pump', 'isPBTS'
              ]
            }
          ]
        }
      ]
    });

    if (!visit) {
      return res.status(404).json({ error: true, message: 'Visita de mantenimiento no encontrada.' });
    }

    res.status(200).json({ visit });
  } catch (error) {
    console.error('❌ Error obteniendo detalles de visita:', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor.' });
  }
};

// --- Cancelar visita por cliente ---
const cancelMaintenanceByClient = async (req, res) => {
  try {
    const { visitId } = req.params;
    const { reason } = req.body;
    const currentUserId = req.staff?.id;

    const visit = await MaintenanceVisit.findByPk(visitId, {
      include: [
        { model: Staff, as: 'assignedStaff', attributes: ['id', 'name', 'email'] },
        { model: Work, as: 'work', attributes: ['idWork', 'propertyAddress'] }
      ]
    });

    if (!visit) {
      return res.status(404).json({ error: true, message: 'Visita de mantenimiento no encontrada.' });
    }

    await visit.update({
      status: 'cancelled_by_client',
      cancellationReason: reason || 'Cliente no desea mantenimiento',
      cancellationDate: new Date().toISOString().split('T')[0],
      actualVisitDate: new Date().toISOString().split('T')[0]
    });

    console.log(`✅ [MaintenanceController] Visita ${visitId} cancelada por cliente`);

    res.json({
      success: true,
      message: 'Visita cancelada por solicitud del cliente',
      visit: visit
    });
  } catch (error) {
    console.error('❌ Error al cancelar visita por cliente:', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor.' });
  }
};

// --- Postergar visita por cliente ausente ---
const postponeMaintenanceNoAccess = async (req, res) => {
  try {
    const { visitId } = req.params;
    const { reason, rescheduledDate } = req.body;
    const currentUserId = req.staff?.id;

    const visit = await MaintenanceVisit.findByPk(visitId, {
      include: [
        { model: Staff, as: 'assignedStaff', attributes: ['id', 'name', 'email'] },
        { model: Work, as: 'work', attributes: ['idWork', 'propertyAddress'] }
      ]
    });

    if (!visit) {
      return res.status(404).json({ error: true, message: 'Visita de mantenimiento no encontrada.' });
    }

    await visit.update({
      status: 'postponed_no_access',
      cancellationReason: reason || 'Cliente no estaba presente',
      cancellationDate: new Date().toISOString().split('T')[0],
      rescheduledDate: rescheduledDate || null,
      actualVisitDate: new Date().toISOString().split('T')[0]
    });

    console.log(`📅 [MaintenanceController] Visita ${visitId} postergada - cliente ausente`);

    res.json({
      success: true,
      message: 'Visita postergada - cliente no disponible',
      visit: visit
    });
  } catch (error) {
    console.error('❌ Error al postergar visita:', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor.' });
  }
};

// --- Cancelar por otros motivos ---
const cancelMaintenanceOther = async (req, res) => {
  try {
    const { visitId } = req.params;
    const { reason } = req.body;
    const currentUserId = req.staff?.id;

    if (!reason) {
      return res.status(400).json({ error: true, message: 'Debe especificar el motivo de cancelación.' });
    }

    const visit = await MaintenanceVisit.findByPk(visitId, {
      include: [
        { model: Staff, as: 'assignedStaff', attributes: ['id', 'name', 'email'] },
        { model: Work, as: 'work', attributes: ['idWork', 'propertyAddress'] }
      ]
    });

    if (!visit) {
      return res.status(404).json({ error: true, message: 'Visita de mantenimiento no encontrada.' });
    }

    await visit.update({
      status: 'cancelled_other',
      cancellationReason: reason,
      cancellationDate: new Date().toISOString().split('T')[0],
      actualVisitDate: new Date().toISOString().split('T')[0]
    });

    console.log(`🚫 [MaintenanceController] Visita ${visitId} cancelada por otros motivos: ${reason}`);

    res.json({
      success: true,
      message: 'Visita cancelada',
      visit: visit
    });
  } catch (error) {
    console.error('❌ Error al cancelar visita:', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor.' });
  }
};

module.exports = {
  scheduleInitialMaintenanceVisits, // Exportar para uso interno
  scheduleMaintenanceVisits, // Nueva función para programar manualmente
  initializeHistoricalMaintenance, // Nueva función para mantenimiento histórico
  createMaintenanceVisit, // Nueva función para crear visita individual
  getMaintenanceVisitsForWork,
  getMaintenanceVisitDetails, // ⭐ Nueva función para obtener detalles completos
  updateMaintenanceVisit,
  addMediaToMaintenanceVisit,
  deleteMaintenanceMedia,
  getAssignedMaintenances, // ⭐ Nueva función
  generateMaintenanceToken, // ⭐ Nueva función
  completeMaintenanceVisit, // ⭐ Nueva función
  getAllCompletedMaintenances, // ⭐ Para Owner/Admin
  downloadMaintenancePDF, // 📄 Generar PDF
  uploadMaintenanceImage, // 📸 Subir imagen individual (autoguardado)
  // 🆕 Nuevas funciones para cancelaciones
  cancelMaintenanceByClient,   // Cliente no quiere mantenimiento
  postponeMaintenanceNoAccess, // Cliente no está presente
  cancelMaintenanceOther       // Otros motivos
};