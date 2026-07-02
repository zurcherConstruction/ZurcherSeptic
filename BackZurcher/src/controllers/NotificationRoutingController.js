const { NotificationRouting, Staff } = require('../data');

const EVENT_TYPES = [
  // ── Obras: estado del trabajo ───────────────────────────────────────────
  { key: 'pending',                          label: 'Obra confirmada – asignar fecha',               category: 'Obras' },
  { key: 'assigned',                         label: 'Obra asignada a técnico (compra de materiales)', category: 'Obras' },
  { key: 'installed',                        label: 'Sistema instalado – pedir 1ª inspección',       category: 'Obras' },
  { key: 'installed_fee',                    label: 'Sistema instalado – pagar fee de inspección',   category: 'Obras' },
  { key: 'initial_inspection_approved',      label: 'Inspección inicial aprobada – ATU: cargar docs finales', category: 'Obras' },
  { key: 'covered',                          label: 'Obra tapada – enviar invoice final',            category: 'Obras' },

  // ── Presupuestos ────────────────────────────────────────────────────────
  { key: 'budgetCreated',                    label: 'Presupuesto creado – listo para enviar',        category: 'Presupuestos' },

  // ── Flota ────────────────────────────────────────────────────────────────
  { key: 'fleet_registration',               label: 'Vencimiento de Placa / Registro',               category: 'Flota' },
  { key: 'fleet_insurance',                  label: 'Vencimiento de Seguro',                         category: 'Flota' },
  { key: 'fleet_maintenance',                label: 'Mantenimiento Programado',                      category: 'Flota' },

  // ── Knowledge Base ───────────────────────────────────────────────────────
  { key: 'kb_doc_expiry',                    label: 'Documentos por Vencer (KB)',                    category: 'Knowledge Base' },

  // ── Legal ────────────────────────────────────────────────────────────────
  { key: 'notice_to_owner_35',               label: 'Notice to Owner – día 35 (10 días para vencer)', category: 'Legal' },
];

const NotificationRoutingController = {

  async getAll(req, res) {
    try {
      const routings = await NotificationRouting.findAll({
        include: [{ model: Staff, as: 'staff', attributes: ['id', 'name', 'role'] }],
      });

      const routingMap = {};
      routings.forEach(r => { routingMap[r.eventType] = r; });

      const result = EVENT_TYPES.map(et => ({
        eventType: et.key,
        label:     et.label,
        category:  et.category,
        staffId:   routingMap[et.key]?.staffId || null,
        staff:     routingMap[et.key]?.staff    || null,
      }));

      return res.json({ success: true, routings: result });
    } catch (error) {
      console.error('[NotificationRouting] getAll error:', error.message);
      return res.status(500).json({ error: true, message: error.message });
    }
  },

  async upsert(req, res) {
    try {
      const { routings } = req.body;
      if (!Array.isArray(routings)) {
        return res.status(400).json({ error: true, message: 'routings debe ser un array' });
      }
      for (const r of routings) {
        if (!r.eventType || !r.staffId) continue;
        await NotificationRouting.upsert({ eventType: r.eventType, staffId: r.staffId });
      }
      return res.json({ success: true, message: 'Configuración guardada' });
    } catch (error) {
      console.error('[NotificationRouting] upsert error:', error.message);
      return res.status(500).json({ error: true, message: error.message });
    }
  },
};

module.exports = NotificationRoutingController;
