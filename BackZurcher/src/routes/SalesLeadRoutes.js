const express = require('express');
const router = express.Router();
const SalesLeadController = require('../controllers/SalesLeadController');
const { verifyToken } = require('../middleware/isAuth');
const { allowRoles } = require('../middleware/byRol');

// Roles autorizados para gestionar leads: admin, owner, recept, sales_rep, follow-up
const authorizedRoles = ['admin', 'owner', 'recept', 'sales_rep', 'follow-up'];

// 📊 Dashboard de estadísticas (debe ir antes de /:id para no confundir)
router.get('/dashboard/stats', verifyToken, allowRoles(authorizedRoles), SalesLeadController.getDashboardStats);

// � Métricas de actividad (nuevos + contactados por período)
router.get('/activity/metrics', verifyToken, allowRoles(authorizedRoles), SalesLeadController.getActivityMetrics);
// 📊 Reporte semanal de actividad por staff
router.get('/reports/weekly-activity', verifyToken, allowRoles(authorizedRoles), SalesLeadController.getWeeklyActivityReport);

// 🔔 Alertas: Leads con múltiples intentos sin respuesta
router.get('/alerts/no-answer', verifyToken, allowRoles(authorizedRoles), SalesLeadController.getNoAnswerLeads);
// 🚫 Leads sin teléfono ni email
router.get('/no-contact', verifyToken, allowRoles(['admin', 'owner']), SalesLeadController.getNoContactLeads);
router.delete('/no-contact/bulk', verifyToken, allowRoles(['admin', 'owner']), SalesLeadController.deleteNoContactLeads);

// �🔍 Verificar si ya existe un lead con esa dirección
router.get('/check-by-address', verifyToken, allowRoles(authorizedRoles), SalesLeadController.checkLeadByAddress);

// � Verificar duplicados (email, teléfono, dirección) en todo el sistema
router.get('/check-duplicates', verifyToken, allowRoles(authorizedRoles), SalesLeadController.checkDuplicates);

// �📝 Crear un nuevo lead
router.post('/', verifyToken, allowRoles(authorizedRoles), SalesLeadController.createLead);

// 📋 Listar leads con filtros y paginación
// GET /sales-leads?page=1&pageSize=20&status=new&priority=high&search=john&tags=urgent&source=website
router.get('/', verifyToken, allowRoles(authorizedRoles), SalesLeadController.getLeads);

// 🔍 Obtener un lead por ID
router.get('/:id', verifyToken, allowRoles(authorizedRoles), SalesLeadController.getLeadById);

// ✏️ Actualizar un lead
router.put('/:id', verifyToken, allowRoles(authorizedRoles), SalesLeadController.updateLead);

// 🗑️ Archivar un lead
router.patch('/:id/archive', verifyToken, allowRoles(authorizedRoles), SalesLeadController.archiveLead);

// ❌ Eliminar permanentemente un lead (solo admin/owner)
router.delete('/:id', verifyToken, allowRoles(['admin', 'owner']), SalesLeadController.deleteLead);

// 🔄 Convertir lead a presupuesto
router.post('/:id/convert-to-budget', verifyToken, allowRoles(authorizedRoles), SalesLeadController.convertToBudget);

// 🔔 Ejecutar manualmente verificación de recordatorios de leads
router.post('/check-reminders', verifyToken, allowRoles(authorizedRoles), async (req, res) => {
  try {
    const { checkLeadReminders } = require('../services/checkLeadReminders');
    await checkLeadReminders();
    res.json({
      success: true,
      message: 'Verificación de recordatorios completada. Revisa los logs del servidor para ver los resultados.'
    });
  } catch (error) {
    console.error('Error al verificar recordatorios de leads:', error);
    res.status(500).json({
      success: false,
      details: error.message
    });
  }
});

module.exports = router;
