const express = require('express');
const WorkController = require('../controllers/WorkController');
const router = express.Router();

// ========== RUTAS PÚBLICAS DE WORKS (SIN AUTENTICACIÓN) ==========
// Estas rutas permiten a los clientes firmar contratos sin necesitar login

/**
 * Generar URL de firma on-demand y redirigir a DocuSign
 * GET /api/work/:idWork/maintenance-contract/sign
 * Público — se usa en el email enviado al cliente
 */
router.get('/:idWork/maintenance-contract/sign', WorkController.getMaintenanceContractSigningUrl);

/**
 * Verificar estado de firma (para la página pública de firma)
 * GET /api/work/:idWork/maintenance-contract/public-status
 * Público — usado por MaintenanceContractSignPage antes de mostrar el botón
 */
router.get('/:idWork/maintenance-contract/public-status', WorkController.checkMaintenanceContractSignature);

module.exports = router;
