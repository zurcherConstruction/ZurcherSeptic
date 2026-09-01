const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('MaintenanceVisit', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
    },
    workId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Works', // Nombre de la tabla Works
        key: 'idWork',
      },
    },
    visitNumber: { // 1, 2, 3, 4
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    scheduledDate: { // Fecha teórica para la visita
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    actualVisitDate: { // Fecha en que realmente se realizó
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
     staffId: {
      type: DataTypes.UUID, // Asegúrate que coincida con el tipo de 'id' en tu modelo Staff
      allowNull: true, // Puede ser nulo si la visita aún no está asignada
      references: {
        model: 'Staffs', // El nombre de la tabla de tu modelo Staff (usualmente el plural del nombre del modelo)
        key: 'id',       // La clave primaria en tu modelo Staff
      },
    },
    status: {
      type: DataTypes.ENUM(
        'pending_scheduling', 
        'scheduled', 
        'completed', 
        'skipped', 
        'assigned',
        'cancelled_by_client',    // 🆕 Cliente no quiere mantenimiento
        'postponed_no_access',    // 🆕 Cliente no está, reagendar
        'cancelled_other'         // 🆕 Otros motivos de cancelación
      ),
      allowNull: false,
      defaultValue: 'pending_scheduling',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    
    // 🆕 Campos para manejar cancelaciones y postergaciones
    cancellationReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'cancellation_reason',
      comment: 'Motivo detallado de cancelación o postergación'
    },
    rescheduledDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'rescheduled_date',
      comment: 'Nueva fecha propuesta cuando se posterga'
    },
    cancellationDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'cancellation_date',
      comment: 'Fecha en que se canceló o postergó'
    },
    
    // === Campos del formulario de inspección ===
    // Niveles del tanque (nuevos campos con STRING para medidas descriptivas)
    tank_inlet_level: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Nivel de entrada del tanque (ej: "12 pulgadas")'
    },
    tank_inlet_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tank_outlet_level: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Nivel de salida del tanque (ej: "8 pulgadas")'
    },
    tank_outlet_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    
    // Niveles legacy (mantener por compatibilidad)
    level_inlet: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    level_outlet: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    
    // Inspección General
    strong_odors: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    strong_odors_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    water_level_ok: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    water_level_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    visible_leaks: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    visible_leaks_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    area_around_dry: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    area_around_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    septic_access_clear: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: '¿Acceso al séptico despejado?'
    },
    septic_access_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cap_green_inspected: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: '¿T de inspección cap verde?'
    },
    cap_green_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    needs_pumping: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    needs_pumping_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas sobre si necesita bombeo'
    },
    
    // Sistema ATU / ATU PBTS
    blower_working: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    blower_working_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    blower_filter_clean: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    blower_filter_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    diffusers_bubbling: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    diffusers_bubbling_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    discharge_pump_ok: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    discharge_pump_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    clarified_water_outlet: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    clarified_water_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    alarm_test: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: '¿Prueba de alarma funcionando?'
    },
    alarm_test_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    
    // Control de secciones opcionales
    has_lift_station: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: '¿Tiene Lift Station? (controla visibilidad de la sección)'
    },
    has_pbts: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: '¿Tiene PBTS? (controla visibilidad de la sección)'
    },
    
    // Lift Station
    pump_running: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: '¿Bomba funcionando?'
    },
    pump_running_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    float_switches: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: '¿Flotantes en buena condición?'
    },
    float_switches_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    alarm_working: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: '¿Panel de alarma funcionando?'
    },
    alarm_working_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    pump_condition: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: '¿Bomba en buena condición?'
    },
    pump_condition_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Lift Station (campos legacy)
    alarm_panel_working: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    alarm_panel_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    pump_working: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    pump_working_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    float_switch_good: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    float_switch_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    
    // PBTS/ATU - Campos específicos
    well_points_quantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Cantidad de well points encontrados (para sistemas PBTS/ATU)'
    },
    well_sample_1_url: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'URL de la foto de la muestra 1 (para sistemas PBTS/ATU)'
    },
    well_sample_1_observations: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Observaciones de la muestra 1'
    },
    well_sample_1_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas adicionales de la muestra 1'
    },
    well_sample_2_url: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'URL de la foto de la muestra 2 (para sistemas PBTS/ATU)'
    },
    well_sample_2_observations: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Observaciones de la muestra 2'
    },
    well_sample_2_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas adicionales de la muestra 2'
    },
    well_sample_3_url: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'URL de la foto de la muestra 3 (para sistemas PBTS/ATU)'
    },
    well_sample_3_observations: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Observaciones de la muestra 3'
    },
    well_sample_3_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas adicionales de la muestra 3'
    },
    well_samples: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: 'Datos adicionales de las muestras (legacy field)'
    },
    
    // Video del sistema
    system_video_url: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'URL del video general del sistema'
    },
    
    // 🆕 Imagen final del sistema completo (OBLIGATORIA)
    final_system_image_url: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'URL de la imagen final del sistema completo (obligatoria al completar)'
    },
    
    // Observaciones generales y firma
    general_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    signature_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    
    // Quién completó el formulario
    completed_by_staff_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Staffs',
        key: 'id',
      },
    },

    // === Notificación al cliente (D-7, D-4, D-1) ===
    clientStatus: {
      type: DataTypes.ENUM(
        'pending_notification',  // aún no notificado
        'notified',              // email enviado, sin respuesta
        'confirmed',             // cliente confirmó
        'rejected',              // cliente rechazó
        'reschedule_requested',  // cliente quiere otra fecha
        'waived'                 // 3 intentos sin respuesta → HD waiver
      ),
      allowNull: false,
      defaultValue: 'pending_notification',
    },
    notificationCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    lastNotificationSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    clientToken: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    clientProposedDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    clientRespondedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    timestamps: true, // createdAt y updatedAt
  });
};