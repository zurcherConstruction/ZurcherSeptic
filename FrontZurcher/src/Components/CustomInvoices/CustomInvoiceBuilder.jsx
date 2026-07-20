import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../utils/axios';
import { toast } from 'react-toastify';

const TYPE_OPTIONS = [
  { value: 'INV', label: 'Invoice (INV)' },
  { value: 'QUO', label: 'Quote/Estimate (QUO)' },
  { value: 'PRO', label: 'Proforma (PRO)' },
  { value: 'CRN', label: 'Credit Note (CRN)' },
  { value: 'REC', label: 'Receipt (REC)' },
];

const EMPTY_ITEM = { name: '', description: '', quantity: 1, unitPrice: 0, amount: 0, amountDisplay: 'price' };

const COMPANY_DEFAULTS = {
  companyName: 'ZURCHER CONSTRUCTION',
  companyEmail: 'admin@zurcherseptic.com',
  companyPhone: '+1 (954) 636-8200',
  companyAddress: 'SEPTIC TANK DIVISION - CFC1433240',
};

const TC_SECTIONS = [
  {
    id: 'acceptance',
    title: '1. ACCEPTANCE OF TERMS AND CONDITIONS',
    text: 'The Client declares to have read, understood, and accepted the terms and conditions set forth in this agreement. Acceptance of these terms is mandatory for the provision of the services described herein.',
  },
  {
    id: 'scope',
    title: '2. SCOPE OF WORK',
    text: 'The Provider agrees to perform the work described in this document, supplying all labor, materials, and equipment necessary. Work not expressly included in this agreement will be subject to additional charges and will require a written change order signed by both parties. The Provider does not include, unless expressly agreed in writing: electrical work, landscaping, irrigation, fencing, removal of trees/sod, additional engineering tests, haul-off of debris beyond what is standard, or damage repairs to driveways, walkways, sprinklers, cables, or unmarked underground lines.',
  },
  {
    id: 'client_obligations',
    title: '3. CLIENT\'S OBLIGATIONS',
    text: 'The Client agrees to: provide full access to the property and keep the area clear of debris or obstructions; supply any required documents to facilitate permitting or inspection; be responsible for any unmarked private underground lines; obtain required permits unless otherwise agreed in writing; and avoid placing heavy loads on the work area after completion, as this may cause damage and void the warranty.',
  },
  {
    id: 'payment',
    title: '4. PAYMENT TERMS',
    text: 'A deposit is required prior to the start of work as specified in this document. The remaining balance must be paid upon completion. Permit fees must be paid in advance and are non-refundable. Invoices not paid within 30 days of the due date are subject to a 1.5% monthly finance charge (18% annually). All checks should be made payable to Zurcher Construction.',
  },
  {
    id: 'timeline',
    title: '5. EXECUTION TIMELINE',
    text: 'Work will begin on the agreed-upon date, subject to weather conditions or delays beyond the Provider\'s control. In the event of encountering unsuitable soil conditions or other unforeseen circumstances, additional charges may apply and will be discussed with the Client before proceeding.',
  },
  {
    id: 'change_orders',
    title: '6. CHANGE ORDERS AND ADDITIONAL WORK',
    text: 'Any changes to the scope of work requested by the Client must be agreed upon in writing through a Change Order. Additional work beyond the agreed scope will be billed at the Provider\'s standard rates.',
  },
  {
    id: 'warranty',
    title: '7. WARRANTY',
    text: 'Zurcher Construction warrants all workmanship for a period of one (1) year from the date of completion, provided the work is used in accordance with the established conditions. Component parts are subject to the manufacturer\'s warranty. Damage caused by misuse, neglect, unauthorized modifications, freezing, flooding, or other causes beyond our control will void the warranty.',
  },
  {
    id: 'liability',
    title: '8. LIMITATION OF LIABILITY',
    text: 'Zurcher Construction\'s liability shall not exceed the total contract price. The Provider is not responsible for: any damage to landscaping, private utility lines, or other structures caused during standard work; any direct, indirect, incidental, or consequential damages resulting from the use or misuse of the completed work; or the performance of the work if affected by external factors such as surface water, improper use, or lack of maintenance.',
  },
  {
    id: 'termination',
    title: '9. CONTRACT TERMINATION',
    text: 'This agreement may be terminated by mutual consent of both parties, or by either party in the event of material breach with written notice. The Client may terminate at any time with written notice; however, the Client shall be responsible for payment of all work completed and costs incurred up to the cancellation date.',
  },
  {
    id: 'attorneys',
    title: 'NOTE: ATTORNEYS\' FEES AND COSTS',
    text: 'In the event of any dispute, claim, or litigation arising out of, or related in any way to, this Agreement, the prevailing party shall be entitled to recover from the non-prevailing party all attorneys\' fees, court costs, expert witness fees, and expenses actually incurred, whether before or after the filing of a lawsuit, and including any appeals, arbitration, mediation, or bankruptcy proceedings.',
  },
  {
    id: 'acknowledgment',
    title: 'CLIENT ACKNOWLEDGMENT',
    text: 'By signing this agreement, the Client authorizes the Provider to proceed with the work and agrees to comply with all terms and conditions outlined herein.',
  },
];

export default function CustomInvoiceBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id && id !== 'new';

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState('');
  const [activeTab, setActiveTab] = useState('basic');
  const [savedId, setSavedId] = useState(null);

  const [form, setForm] = useState({
    invoiceType: 'INV',
    overrideNumber: '',
    // Client
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    clientAddress: '',
    clientCompany: '',
    // Company
    ...COMPANY_DEFAULTS,
    // Items
    items: [{ ...EMPTY_ITEM }],
    // Financials
    discountAmount: 0,
    discountDescription: '',
    taxRate: 0,
    // Content — T&C built from selectedTcSections + additionalTerms on save
    selectedTcSections: [],
    additionalTerms: '',
    notes: '',
    // Dates
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    // Links
    budgetId: '',
    workId: '',
    // Options
    priceDisplay: 'prices',
    requireSignature: false,
    requirePayment: false,
    paymentPercentage: 100,
  });

  const [computed, setComputed] = useState({ subtotal: 0, taxAmount: 0, total: 0, paymentAmount: 0 });

  // Address-based search for Budget / Work links
  const [budgetSearch, setBudgetSearch] = useState('');
  const [budgetResults, setBudgetResults] = useState([]);
  const [budgetSearching, setBudgetSearching] = useState(false);
  const [budgetSelected, setBudgetSelected] = useState(null); // { id, address }
  const [workSearch, setWorkSearch] = useState('');
  const [workResults, setWorkResults] = useState([]);
  const [workSearching, setWorkSearching] = useState(false);
  const [workSelected, setWorkSelected] = useState(null); // { id, address }
  const budgetTimer = useRef(null);
  const workTimer = useRef(null);

  // Catalog picker
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogCategory, setCatalogCategory] = useState('');
  const [catalogItemId, setCatalogItemId] = useState('');
  const [existingInvoiceNumber, setExistingInvoiceNumber] = useState('');

  // Load existing invoice for edit
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const { data } = await api.get(`/custom-invoices/${id}`);
        const inv = data.data;
        setForm({
          invoiceType: inv.invoiceType || 'INV',
          overrideNumber: '',
          clientName: inv.clientName || '',
          clientEmail: inv.clientEmail || '',
          clientPhone: inv.clientPhone || '',
          clientAddress: inv.clientAddress || '',
          clientCompany: inv.clientCompany || '',
          companyName: inv.companyName || COMPANY_DEFAULTS.companyName,
          companyEmail: inv.companyEmail || COMPANY_DEFAULTS.companyEmail,
          companyPhone: inv.companyPhone || COMPANY_DEFAULTS.companyPhone,
          companyAddress: inv.companyAddress || COMPANY_DEFAULTS.companyAddress,
          items: inv.items?.length ? inv.items : [{ ...EMPTY_ITEM }],
          discountAmount: parseFloat(inv.discountAmount || 0),
          discountDescription: inv.discountDescription || '',
          taxRate: parseFloat(inv.taxRate || 0),
          ...(() => {
            // Restore which TC sections were selected from stored text
            const stored = inv.termsAndConditions || '';
            const blocks = stored.split('\n\n');
            const selectedIds = [];
            const extraBlocks = [];
            for (const block of blocks) {
              const firstLine = block.split('\n')[0];
              const match = TC_SECTIONS.find(s => s.title === firstLine);
              if (match) selectedIds.push(match.id);
              else if (block.trim()) extraBlocks.push(block.trim());
            }
            return {
              selectedTcSections: selectedIds,
              additionalTerms: extraBlocks.join('\n\n'),
            };
          })(),
          notes: inv.notes || '',
          issueDate: inv.issueDate || new Date().toISOString().split('T')[0],
          dueDate: inv.dueDate || '',
          budgetId: inv.budgetId || '',
          workId: inv.workId || '',
          priceDisplay: inv.priceDisplay || 'prices',
          requireSignature: inv.requireSignature || false,
          requirePayment: inv.requirePayment || false,
          paymentPercentage: parseFloat(inv.paymentPercentage || 100),
        });
        setExistingInvoiceNumber(inv.invoiceNumber || '');
        setPaymentLinkUrl(inv.stripePaymentLinkUrl || '');
        setSavedId(inv.id);
        // Pre-populate link badges when editing
        if (inv.budgetId) {
          setBudgetSelected({ id: inv.budgetId, address: `Budget #${inv.budgetId}` });
          try {
            const { data: bd } = await api.get(`/budget/${inv.budgetId}`);
            if (bd?.propertyAddress) setBudgetSelected({ id: inv.budgetId, address: bd.propertyAddress });
          } catch { /* use fallback label */ }
        }
        if (inv.workId) {
          setWorkSelected({ id: inv.workId, address: `Work ${inv.workId.slice(0, 8)}…` });
          try {
            const { data: wd } = await api.get(`/work/${inv.workId}`);
            if (wd?.propertyAddress) setWorkSelected({ id: inv.workId, address: wd.propertyAddress });
          } catch { /* use fallback label */ }
        }
      } catch {
        toast.error('Error cargando invoice');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  // Recompute totals whenever items or discounts change
  useEffect(() => {
    const subtotal = form.items.reduce((s, item) => {
      const amt = parseFloat(item.amount) || (parseFloat(item.quantity || 1) * parseFloat(item.unitPrice || 0));
      return s + amt;
    }, 0);
    const disc = parseFloat(form.discountAmount) || 0;
    const rate = parseFloat(form.taxRate) || 0;
    const afterDisc = subtotal - disc;
    const taxAmt = afterDisc * (rate / 100);
    const total = afterDisc + taxAmt;
    const pct = parseFloat(form.paymentPercentage) || 100;
    setComputed({
      subtotal: +subtotal.toFixed(2),
      taxAmount: +taxAmt.toFixed(2),
      total: +total.toFixed(2),
      paymentAmount: +(total * pct / 100).toFixed(2),
    });
  }, [form.items, form.discountAmount, form.taxRate, form.paymentPercentage]);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const setItem = (i, field, value) => {
    setForm(f => {
      const items = [...f.items];
      items[i] = { ...items[i], [field]: value };
      // Auto-compute amount from qty * unitPrice
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = parseFloat(field === 'quantity' ? value : items[i].quantity) || 1;
        const price = parseFloat(field === 'unitPrice' ? value : items[i].unitPrice) || 0;
        items[i].amount = +(qty * price).toFixed(2);
      }
      return { ...f, items };
    });
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }));
  const removeItem = i => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const addItemFromCatalog = (catItem) => {
    // INCLUDED column = category, DESCRIPTION column = name + marca/capacity/description
    const descParts = [
      catItem.name,
      catItem.marca,
      catItem.capacity,
      catItem.description,
    ].filter(Boolean);
    const newItem = {
      name: catItem.category || catItem.name || '',
      description: descParts.join(' - '),
      quantity: 1,
      unitPrice: parseFloat(catItem.unitPrice) || 0,
      amount: parseFloat(catItem.unitPrice) || 0,
      amountDisplay: 'price',
    };
    setForm(f => ({ ...f, items: [...f.items.filter(it => it.name), newItem] }));
  };

  const loadCatalog = async () => {
    if (catalogItems.length) { setShowCatalog(v => !v); return; }
    setCatalogLoading(true);
    try {
      const { data } = await api.get('/budget-item');
      const active = (data || []).filter(i => i.isActive !== false);
      setCatalogItems(active);
      if (active.length) {
        const firstCat = active[0].category || '';
        setCatalogCategory(firstCat);
        setCatalogItemId('');
      }
      setShowCatalog(true);
    } catch { /* silent */ }
    finally { setCatalogLoading(false); }
  };

  const catalogCategories = [...new Set(catalogItems.map(i => i.category).filter(Boolean))].sort();
  const catalogItemsInCategory = catalogItems.filter(i => i.category === catalogCategory);

  const toggleTcSection = id => setForm(f => ({
    ...f,
    selectedTcSections: f.selectedTcSections.includes(id)
      ? f.selectedTcSections.filter(x => x !== id)
      : [...f.selectedTcSections, id],
  }));

  const handleSave = async () => {
    if (!form.clientName.trim()) { toast.error('Nombre del cliente requerido'); return; }
    if (!form.items.length || !form.items[0].name) { toast.error('Se requiere al menos un item'); return; }

    setSaving(true);
    try {
      const tcFromPresets = form.selectedTcSections
        .map(id => TC_SECTIONS.find(s => s.id === id))
        .filter(Boolean)
        .map(s => `${s.title}\n${s.text}`)
        .join('\n\n');
      const termsAndConditions = [tcFromPresets, form.additionalTerms.trim()].filter(Boolean).join('\n\n');

      const payload = {
        ...form,
        termsAndConditions: termsAndConditions || null,
        items: form.items.map(item => ({
          ...item,
          quantity: parseFloat(item.quantity) || 1,
          unitPrice: parseFloat(item.unitPrice) || 0,
          amount: parseFloat(item.amount) || 0,
        })),
        discountAmount: parseFloat(form.discountAmount) || 0,
        taxRate: parseFloat(form.taxRate) || 0,
        paymentPercentage: parseFloat(form.paymentPercentage) || 100,
        budgetId: form.budgetId || undefined,
        workId: form.workId || undefined,
        overrideNumber: form.overrideNumber || undefined,
        selectedTcSections: undefined,
        additionalTerms: undefined,
      };

      let resp;
      if (isEdit) {
        resp = await api.put(`/custom-invoices/${id}`, payload);
        toast.success('Invoice actualizado');
        setSavedId(resp.data.data.id);
      } else {
        resp = await api.post('/custom-invoices', payload);
        toast.success(`${resp.data.data.invoiceNumber} creado`);
        setSavedId(resp.data.data.id);
        navigate(`/custom-invoices/${resp.data.data.id}`, { replace: true });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    const targetId = savedId || id;
    if (!targetId || targetId === 'new') { toast.warning('Guarda primero el invoice'); return; }
    try {
      const response = await api.get(`/custom-invoices/${targetId}/download`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Revoke after a short delay so the new tab has time to load
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch { toast.error('Error generando PDF'); }
  };

  const handleDownload = async () => {
    const targetId = savedId || id;
    if (!targetId || targetId === 'new') { toast.warning('Guarda primero el invoice'); return; }
    try {
      const response = await api.get(`/custom-invoices/${targetId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${form.overrideNumber || targetId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Error descargando PDF'); }
  };

  const handleSend = async () => {
    const targetId = savedId || id;
    if (!targetId || targetId === 'new') { toast.warning('Guarda primero el invoice'); return; }
    if (!form.clientEmail) { toast.error('El invoice no tiene email de cliente'); return; }
    if (!window.confirm(`¿Enviar al email ${form.clientEmail}?`)) return;
    setSending(true);
    try {
      const { data } = await api.post(`/custom-invoices/${targetId}/send`);
      toast.success('Enviado correctamente');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al enviar');
    } finally {
      setSending(false);
    }
  };

  const handleSendForSignature = async () => {
    const targetId = savedId || id;
    if (!targetId || targetId === 'new') { toast.warning('Guarda primero el invoice'); return; }
    if (!form.clientEmail) { toast.error('El invoice no tiene email de cliente'); return; }
    if (!window.confirm(`¿Enviar para firma a ${form.clientEmail} via DocuSign?`)) return;
    setSending(true);
    try {
      await api.post(`/custom-invoices/${targetId}/send-for-signature`);
      toast.success('Documento enviado para firma');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error enviando para firma');
    } finally {
      setSending(false);
    }
  };

  const handleCreatePaymentLink = async () => {
    const targetId = savedId || id;
    if (!targetId || targetId === 'new') { toast.warning('Guarda primero el invoice'); return; }
    setGeneratingLink(true);
    try {
      const { data } = await api.post(`/custom-invoices/${targetId}/create-payment-link`);
      setPaymentLinkUrl(data.data.url);
      toast.success('Link de pago creado');
      window.open(data.data.url, '_blank');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error creando link');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleClearPaymentLink = async () => {
    const targetId = savedId || id;
    if (!targetId || targetId === 'new') return;
    try {
      await api.delete(`/custom-invoices/${targetId}/payment-link`);
      setPaymentLinkUrl('');
      toast.success('Link de pago eliminado');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error eliminando link');
    }
  };

  const formatCurrency = v => `$${parseFloat(v || 0).toFixed(2)}`;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  const TabBtn = ({ tab, label }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition ${
        activeTab === tab
          ? 'border-blue-600 text-blue-700 bg-white'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => navigate('/custom-invoices')} className="text-sm text-gray-400 hover:text-gray-600 mb-1">
            ← Volver a la lista
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Editar Documento' : 'Nuevo Documento'}
          </h1>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={handlePreview}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            title="Vista previa del PDF"
          >
            👁 Vista Previa
          </button>
          <button
            onClick={handleDownload}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            title="Descargar PDF"
          >
            ⬇ Descargar
          </button>
          {form.clientEmail && (
            <button
              onClick={handleSend}
              disabled={sending}
              className="px-3 py-2 text-sm border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition disabled:opacity-50"
            >
              {sending ? 'Enviando...' : '📤 Enviar'}
            </button>
          )}
          {form.requireSignature && form.clientEmail && (
            <button
              onClick={handleSendForSignature}
              disabled={sending}
              className="px-3 py-2 text-sm border border-green-200 text-green-700 rounded-lg hover:bg-green-50 transition disabled:opacity-50"
            >
              ✍️ Firma
            </button>
          )}
          {form.requirePayment && paymentLinkUrl && (
            <div className="flex items-center gap-1 border border-purple-200 rounded-lg px-2 py-1.5 bg-purple-50 text-xs text-purple-700 font-medium">
              💳 Link activo
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50"
          >
            {saving ? 'Guardando...' : isEdit ? '💾 Actualizar' : '✅ Crear'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-0">
        <TabBtn tab="basic" label="Básico" />
        <TabBtn tab="items" label="Items" />
        <TabBtn tab="totals" label="Totales" />
        <TabBtn tab="content" label="T&C / Notas" />
        <TabBtn tab="options" label="Opciones" />
      </div>

      <div className="bg-white rounded-b-xl rounded-tr-xl shadow-sm border border-gray-100 p-6">

        {/* TAB: BASIC */}
        {activeTab === 'basic' && (
          <div className="space-y-6">
            {/* Invoice header row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo de Documento</label>
                <select
                  value={form.invoiceType}
                  onChange={e => set('invoiceType', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                {isEdit && existingInvoiceNumber ? (
                  <>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Número</label>
                    <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
                      <span className="text-sm font-mono font-semibold text-gray-800">{existingInvoiceNumber}</span>
                      <span className="text-xs text-gray-400">(no editable)</span>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Número <span className="font-normal text-gray-400">(dejar vacío = auto)</span>
                    </label>
                    <input
                      type="text"
                      placeholder={`${form.invoiceType}-${new Date().getFullYear()}-001`}
                      value={form.overrideNumber}
                      onChange={e => set('overrideNumber', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Fecha de emisión</label>
                <input
                  type="date"
                  value={form.issueDate}
                  onChange={e => set('issueDate', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Fecha de vencimiento (opcional)</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => set('dueDate', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Client info — 3-column layout identical to budget PDF header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

              {/* Col 1: CUSTOMER INFO */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-1">Customer Info</p>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={form.clientName}
                    onChange={e => set('clientName', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.clientEmail}
                    onChange={e => set('clientEmail', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={form.clientPhone}
                    onChange={e => set('clientPhone', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="+1 (xxx) xxx-xxxx"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Empresa (opcional)</label>
                  <input
                    type="text"
                    value={form.clientCompany}
                    onChange={e => set('clientCompany', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Col 2: WORK LOCATION */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-1">Work Location</p>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Dirección de la propiedad</label>
                  <textarea
                    value={form.clientAddress}
                    onChange={e => set('clientAddress', e.target.value)}
                    rows={5}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                    placeholder={"1234 Main St\nCity, FL 34xxx"}
                  />
                </div>
              </div>

              {/* Col 3: INITIAL PAYMENT — shows in PDF header when active */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-1">Initial Payment</p>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.requirePayment}
                    onChange={e => set('requirePayment', e.target.checked)}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-700">Requiere pago inicial</span>
                </label>
                {form.requirePayment ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Porcentaje (%)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={form.paymentPercentage}
                          onChange={e => set('paymentPercentage', Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                          className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-center"
                        />
                        <span className="text-sm text-gray-500">%</span>
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500">Monto</p>
                      <p className="text-base font-bold text-blue-700">
                        {formatCurrency(computed.paymentAmount)}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {form.paymentPercentage >= 100 ? 'Total requerido' : `${form.paymentPercentage}% del total`}
                      </p>
                    </div>

                    {/* Payment link — only available after saving */}
                    {(savedId || (isEdit && id)) ? (
                      paymentLinkUrl ? (
                        <div className="border border-purple-200 rounded-lg p-2 bg-purple-50 space-y-1">
                          <p className="text-xs font-semibold text-purple-700">Link de pago activo</p>
                          <div className="flex gap-1">
                            <a href={paymentLinkUrl} target="_blank" rel="noreferrer"
                              className="flex-1 text-xs text-center bg-purple-600 text-white rounded px-2 py-1 hover:bg-purple-700">
                              Abrir link
                            </a>
                            <button
                              type="button"
                              onClick={() => { navigator.clipboard.writeText(paymentLinkUrl); toast.success('Link copiado'); }}
                              className="text-xs bg-white border border-purple-200 text-purple-600 rounded px-2 py-1 hover:bg-purple-50">
                              Copiar
                            </button>
                            <button
                              type="button"
                              onClick={handleClearPaymentLink}
                              className="text-xs bg-white border border-red-200 text-red-500 rounded px-2 py-1 hover:bg-red-50">
                              ✕
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleCreatePaymentLink}
                          disabled={generatingLink}
                          className="w-full text-xs border border-purple-200 text-purple-700 rounded-lg py-2 hover:bg-purple-50 transition disabled:opacity-50"
                        >
                          {generatingLink ? 'Generando...' : '💳 Generar link de pago'}
                        </button>
                      )
                    ) : (
                      <p className="text-xs text-gray-400 italic">Guarda primero para generar link de pago</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-400 italic">
                    Sin pago inicial — se mostrará el total como balance a pagar
                  </div>
                )}
              </div>

            </div>

            <hr className="border-gray-100" />

            {/* Company info (collapsible defaults) */}
            <details>
              <summary className="text-sm font-semibold text-gray-700 cursor-pointer select-none">
                Datos de la Empresa (click para editar)
              </summary>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Nombre</label>
                  <input type="text" value={form.companyName} onChange={e => set('companyName', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                  <input type="text" value={form.companyEmail} onChange={e => set('companyEmail', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Teléfono</label>
                  <input type="text" value={form.companyPhone} onChange={e => set('companyPhone', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">División / Licencia</label>
                  <input type="text" value={form.companyAddress} onChange={e => set('companyAddress', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            </details>

            {/* Optional links — search by address */}
            <details>
              <summary className="text-sm font-semibold text-gray-700 cursor-pointer select-none">
                Vincular a Budget / Work (opcional)
              </summary>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-3">

                {/* Budget search */}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Budget</p>
                  {budgetSelected ? (
                    <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                      <span className="text-sm text-blue-800 font-medium truncate">{budgetSelected.address}</span>
                      <button
                        type="button"
                        onClick={() => { setBudgetSelected(null); setBudgetSearch(''); set('budgetId', ''); }}
                        className="ml-2 text-blue-400 hover:text-red-500 text-xs font-bold shrink-0"
                      >✕</button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={budgetSearch}
                        onChange={e => {
                          const q = e.target.value;
                          setBudgetSearch(q);
                          setBudgetResults([]);
                          clearTimeout(budgetTimer.current);
                          if (q.length < 3) return;
                          budgetTimer.current = setTimeout(async () => {
                            setBudgetSearching(true);
                            try {
                              const { data } = await api.get(`/budget/all?search=${encodeURIComponent(q)}&pageSize=8`);
                              setBudgetResults(data.budgets || []);
                            } catch { /* silent */ }
                            finally { setBudgetSearching(false); }
                          }, 350);
                        }}
                        placeholder="Buscar por dirección..."
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      />
                      {budgetSearching && (
                        <p className="text-xs text-gray-400 mt-1">Buscando...</p>
                      )}
                      {budgetResults.length > 0 && (
                        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                          {budgetResults.map(b => (
                            <li key={b.idBudget}
                              className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                              onClick={() => {
                                set('budgetId', b.idBudget);
                                setBudgetSelected({ id: b.idBudget, address: b.propertyAddress || `#${b.idBudget}` });
                                setBudgetResults([]);
                                setBudgetSearch('');
                              }}
                            >
                              <span className="font-medium text-gray-800">{b.propertyAddress || 'Sin dirección'}</span>
                              <span className="text-gray-400 ml-2 text-xs">#{b.idBudget}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* Work search */}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Work</p>
                  {workSelected ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                      <span className="text-sm text-green-800 font-medium truncate">{workSelected.address}</span>
                      <button
                        type="button"
                        onClick={() => { setWorkSelected(null); setWorkSearch(''); set('workId', ''); }}
                        className="ml-2 text-green-400 hover:text-red-500 text-xs font-bold shrink-0"
                      >✕</button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={workSearch}
                        onChange={e => {
                          const q = e.target.value;
                          setWorkSearch(q);
                          setWorkResults([]);
                          clearTimeout(workTimer.current);
                          if (q.length < 3) return;
                          workTimer.current = setTimeout(async () => {
                            setWorkSearching(true);
                            try {
                              const { data } = await api.get(`/work/?search=${encodeURIComponent(q)}&limit=8`);
                              setWorkResults(data.works || []);
                            } catch { /* silent */ }
                            finally { setWorkSearching(false); }
                          }, 350);
                        }}
                        placeholder="Buscar por dirección..."
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      />
                      {workSearching && (
                        <p className="text-xs text-gray-400 mt-1">Buscando...</p>
                      )}
                      {workResults.length > 0 && (
                        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                          {workResults.map(w => (
                            <li key={w.idWork}
                              className="px-3 py-2 text-sm hover:bg-green-50 cursor-pointer border-b border-gray-50 last:border-0"
                              onClick={() => {
                                set('workId', w.idWork);
                                setWorkSelected({ id: w.idWork, address: w.propertyAddress || w.idWork });
                                setWorkResults([]);
                                setWorkSearch('');
                              }}
                            >
                              <span className="font-medium text-gray-800">{w.propertyAddress || 'Sin dirección'}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </details>
          </div>
        )}

        {/* TAB: ITEMS */}
        {activeTab === 'items' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Items / Líneas</h3>
              <div className="flex gap-3">
                <button
                  onClick={loadCatalog}
                  disabled={catalogLoading}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  {catalogLoading ? 'Cargando...' : showCatalog ? '− Cerrar catálogo' : '+ Desde catálogo'}
                </button>
                <button
                  onClick={addItem}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Agregar manual
                </button>
              </div>
            </div>

            {/* Catalog picker — category select → item select */}
            {showCatalog && catalogItems.length > 0 && (
              <div className="mb-5 border border-indigo-100 rounded-xl bg-indigo-50 p-4">
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3">Catálogo de items</p>
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-indigo-600 mb-1">Categoría</label>
                    <select
                      value={catalogCategory}
                      onChange={e => { setCatalogCategory(e.target.value); setCatalogItemId(''); }}
                      className="border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[160px]"
                    >
                      <option value="">-- Elegir --</option>
                      {catalogCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  {catalogCategory && (
                    <div>
                      <label className="block text-xs font-semibold text-indigo-600 mb-1">Item</label>
                      <select
                        value={catalogItemId}
                        onChange={e => setCatalogItemId(e.target.value)}
                        className="border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[220px]"
                      >
                        <option value="">-- Elegir item --</option>
                        {catalogItemsInCategory.map(ci => (
                          <option key={ci.id} value={ci.id}>
                            {ci.name}
                            {ci.marca ? ` (${ci.marca})` : ''}
                            {ci.capacity ? ` - ${ci.capacity}` : ''}
                            {ci.description ? ` · ${ci.description}` : ''}
                            {ci.unitPrice > 0 ? ` — $${parseFloat(ci.unitPrice).toFixed(2)}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {catalogItemId && (
                    <button
                      type="button"
                      onClick={() => {
                        const ci = catalogItems.find(c => String(c.id) === String(catalogItemId));
                        if (ci) { addItemFromCatalog(ci); setCatalogItemId(''); }
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                    >
                      + Agregar
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {form.items.map((item, i) => {
                const display = item.amountDisplay || 'price';
                return (
                  <div key={i} className="border border-gray-100 rounded-xl p-4 bg-gray-50 relative">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-3">
                        <label className="block text-xs text-gray-500 mb-1">Nombre / Item *</label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={e => setItem(i, 'name', e.target.value)}
                          placeholder="Ej: Labor"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                        />
                      </div>
                      <div className="md:col-span-4">
                        <label className="block text-xs text-gray-500 mb-1">Descripción</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => setItem(i, 'description', e.target.value)}
                          placeholder="Detalles del item..."
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-xs text-gray-500 mb-1">Cant.</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={e => setItem(i, 'quantity', e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Precio Unit.</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={e => setItem(i, 'unitPrice', e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Monto (PDF)</label>
                        {/* Per-item display: show price, INCLUDED, or NOT INCLUDED in PDF */}
                        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium bg-white">
                          {[
                            { v: 'price', label: '$' },
                            { v: 'included', label: 'INC' },
                            { v: 'not_included', label: 'N/INC' },
                          ].map(opt => (
                            <button
                              key={opt.v}
                              type="button"
                              onClick={() => setItem(i, 'amountDisplay', opt.v)}
                              className={`flex-1 py-2 transition ${display === opt.v ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        {display === 'price' && (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.amount}
                            onChange={e => setItem(i, 'amount', e.target.value)}
                            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white font-semibold"
                          />
                        )}
                      </div>
                    </div>
                    {form.items.length > 1 && (
                      <button
                        onClick={() => removeItem(i)}
                        className="absolute top-2 right-2 text-gray-300 hover:text-red-500 text-lg leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={addItem}
              className="mt-4 w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-gray-400 hover:border-blue-300 hover:text-blue-500 text-sm transition"
            >
              + Agregar otro item
            </button>
          </div>
        )}

        {/* TAB: TOTALS */}
        {activeTab === 'totals' && (
          <div className="max-w-lg space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 font-mono text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span><span>{formatCurrency(computed.subtotal)}</span>
              </div>
              {computed.taxAmount > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Impuesto ({form.taxRate}%)</span><span>{formatCurrency(computed.taxAmount)}</span>
                </div>
              )}
              {computed.subtotal !== computed.total && (
                <div className="flex justify-between text-red-500">
                  <span>Descuento</span><span>-{formatCurrency(form.discountAmount)}</span>
                </div>
              )}
              <hr className="border-gray-200" />
              <div className="flex justify-between text-gray-900 font-bold text-base">
                <span>TOTAL</span><span>{formatCurrency(computed.total)}</span>
              </div>
              {form.requirePayment && parseFloat(form.paymentPercentage) < 100 && (
                <div className="flex justify-between text-blue-700 font-semibold">
                  <span>Pago requerido ({form.paymentPercentage}%)</span>
                  <span>{formatCurrency(computed.paymentAmount)}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Descuento ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discountAmount}
                  onChange={e => set('discountAmount', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Descripción del descuento</label>
                <input
                  type="text"
                  value={form.discountDescription}
                  onChange={e => set('discountDescription', e.target.value)}
                  placeholder="Ej: Early payment discount"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Tasa de impuesto (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.taxRate}
                  onChange={e => set('taxRate', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB: CONTENT */}
        {activeTab === 'content' && (
          <div className="space-y-6">
            {/* Predefined T&C sections */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Cláusulas predefinidas
                <span className="ml-2 font-normal normal-case text-gray-400">Selecciona las que apliquen</span>
              </p>
              <div className="space-y-2">
                {TC_SECTIONS.map(section => (
                  <label
                    key={section.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      form.selectedTcSections.includes(section.id)
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.selectedTcSections.includes(section.id)}
                      onChange={() => toggleTcSection(section.id)}
                      className="mt-0.5 w-4 h-4 accent-blue-600 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-700">{section.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{section.text}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Additional custom terms */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">
                Términos adicionales
                <span className="ml-2 font-normal text-gray-400">Se agregarán al final de las cláusulas seleccionadas</span>
              </label>
              <textarea
                value={form.additionalTerms}
                onChange={e => set('additionalTerms', e.target.value)}
                rows={5}
                placeholder="Cualquier término o condición adicional específica para este documento..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>

            <hr className="border-gray-100" />

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Notas para el cliente</label>
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                rows={4}
                placeholder="Any special notes or instructions..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        {/* TAB: OPTIONS */}
        {activeTab === 'options' && (
          <div className="space-y-6 max-w-lg">
            <div className="bg-blue-50 rounded-xl p-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Opciones para el cliente</h3>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requireSignature}
                  onChange={e => set('requireSignature', e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-700">Requiere firma (DocuSign)</p>
                  <p className="text-xs text-gray-400">El cliente deberá firmar el documento</p>
                </div>
              </label>

              {form.requirePayment && (
                <div className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                  Pago inicial configurado: <strong>{form.paymentPercentage >= 100 ? 'Total' : `${form.paymentPercentage}%`}</strong> — {formatCurrency(computed.paymentAmount)}
                  <span className="text-gray-400 ml-1">(editar en pestaña Básico)</span>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Footer totals bar */}
      <div className="mt-4 bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-3 flex items-center justify-between text-sm">
        <span className="text-gray-500">
          {form.items.length} item{form.items.length !== 1 ? 's' : ''}
          {form.discountAmount > 0 && ` · Descuento: ${formatCurrency(form.discountAmount)}`}
        </span>
        <div className="flex items-center gap-4">
          <span className="text-gray-500">Subtotal: <strong>{formatCurrency(computed.subtotal)}</strong></span>
          <span className="text-lg font-bold text-gray-900">Total: {formatCurrency(computed.total)}</span>
        </div>
      </div>
    </div>
  );
}
