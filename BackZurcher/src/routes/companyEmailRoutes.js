const express = require('express');
const router = express.Router();
const CompanyEmailController = require('../controllers/CompanyEmailController');
const { verifyToken } = require('../middleware/isAuth');

// 🔒 Todas las rutas requieren autenticación
router.use(verifyToken);

/**
 * @route   GET /api/company-emails/unique-recipients
 * @desc    Obtiene lista de emails únicos de todas las fuentes (Budgets, Works, SalesLeads, Permits)
 * @access  Privado (admin, owner)
 */
router.get('/unique-recipients', CompanyEmailController.getUniqueRecipients.bind(CompanyEmailController));

/**
 * @route   POST /api/company-emails/send-campaign
 * @desc    Envía email masivo a lista de destinatarios
 * @access  Privado (admin, owner)
 */
router.post('/send-campaign', CompanyEmailController.sendCampaign.bind(CompanyEmailController));

/**
 * @route   GET /api/company-emails/campaigns
 * @desc    Obtiene historial de campañas enviadas
 * @access  Privado (admin, owner)
 */
router.get('/campaigns', CompanyEmailController.getCampaigns.bind(CompanyEmailController));

/**
 * @route   GET /api/company-emails/campaigns/:id
 * @desc    Obtiene detalles de una campaña específica
 * @access  Privado (admin, owner)
 */
router.get('/campaigns/:id', CompanyEmailController.getCampaignDetails.bind(CompanyEmailController));

/**
 * @route   POST /api/company-emails/campaigns/:id/retry-failed
 * @desc    Reenvía la campaña solo a los emails que fallaron
 */
router.post('/campaigns/:id/retry-failed', CompanyEmailController.retryFailed.bind(CompanyEmailController));

module.exports = router;
