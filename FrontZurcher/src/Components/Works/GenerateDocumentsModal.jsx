import React, { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { toast } from 'react-hot-toast';

const Field = ({ label, name, value, onChange, type = 'text', half }) => (
  <div className={half ? 'col-span-1' : 'col-span-2'}>
    <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
    <input
      type={type}
      name={name}
      value={value || ''}
      onChange={onChange}
      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
    />
  </div>
);

const GenerateDocumentsModal = ({ idWork, work, onClose, onDocumentGenerated }) => {
  const [tab, setTab] = useState('contract'); // 'contract' | 'permit'
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [checkingSignature, setCheckingSignature] = useState(false);
  const [signatureStatus, setSignatureStatus] = useState(null); // null | { isSigned, signedAt, signedUrl }
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendEmail, setSendEmail] = useState('');
  const [sendName, setSendName] = useState('');

  const [contract, setContract] = useState({
    propertyAddress: '', customerName: '', customerPhone: '', customerEmail: '',
    customerCity: '', customerState: 'FL', customerZip: '',
    systemModel: '', serialNumber: '', startDate: '',
    lot: '', block: '', subdivision: '',
  });

  const [permit, setPermit] = useState({
    propertyAddress: '', propertyCity: '', propertyState: 'FL', propertyZip: '',
    ownerName: '', ownerPhone: '', ownerEmail: '',
    ownerAddress: '', ownerCity: '', ownerZip: '',
    lot: '', block: '', subdivision: '',
    section: '', township: '', range: '', parcelNo: '',
    applicationNumber: '', systemManufacturer: 'Gorman (delta)',
    systemModel: '', septicTankGallons: '', drainfieldSqFt: '',
    installationDate: '',
    drainfieldType: 'standard_subsurface',
    drainfieldConfig: 'trenches',
    onsiteWell: 'no',
    additionalComments: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await api.get(`/work/${idWork}/document-preview-data`);
        if (data.success) {
          setContract(prev => ({ ...prev, ...data.data.contract }));
          setPermit(prev => ({ ...prev, ...data.data.permit }));
          setSendEmail(data.data.contract.customerEmail || '');
          setSendName(data.data.contract.customerName || '');
        }
      } catch (err) {
        toast.error('Error cargando datos del permit');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [idWork]);

  const handleContractChange = (e) => {
    setContract(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePermitChange = (e) => {
    setPermit(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleGenerateContract = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post(`/work/${idWork}/maintenance-contract/generate`, contract);
      if (data.success) {
        toast.success('Contrato de mantenimiento generado');
        onDocumentGenerated();
      }
    } catch (err) {
      toast.error('Error al generar contrato: ' + (err.response?.data?.message || err.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleGeneratePermit = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post(`/work/${idWork}/operating-permit/generate`, permit);
      if (data.success) {
        toast.success('Permiso de operación generado');
        onDocumentGenerated();
      }
    } catch (err) {
      toast.error('Error al generar permiso: ' + (err.response?.data?.message || err.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleSendToClient = async () => {
    if (!sendEmail) { toast.error('Ingresá un email'); return; }
    setSendingEmail(true);
    try {
      const { data } = await api.post(`/work/${idWork}/maintenance-contract/send`, {
        toEmail: sendEmail,
        toName: sendName,
      });
      if (data.success) {
        toast.success(`Contrato enviado para firma a ${sendEmail} via ${data.data?.signatureMethod === 'docusign' ? 'DocuSign' : 'SignNow'}`);
        setShowSendModal(false);
        setSignatureStatus(null);
        onDocumentGenerated();
      }
    } catch (err) {
      toast.error('Error al enviar: ' + (err.response?.data?.message || err.message));
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCheckSignature = async () => {
    setCheckingSignature(true);
    try {
      const { data } = await api.get(`/work/${idWork}/maintenance-contract/signature-status`);
      setSignatureStatus(data);
      if (data.isSigned) {
        toast.success('¡El contrato ya fue firmado!');
        onDocumentGenerated();
      } else {
        toast('Todavía pendiente de firma', { icon: '⏳' });
      }
    } catch (err) {
      toast.error('Error al verificar: ' + (err.response?.data?.message || err.message));
    } finally {
      setCheckingSignature(false);
    }
  };

  // Calculate 4 visit dates for preview
  const calcVisits = (startDate) => {
    if (!startDate) return [];
    const base = new Date(startDate + 'T12:00:00');
    return [6, 12, 18, 24].map(m => {
      const d = new Date(base);
      d.setMonth(d.getMonth() + m);
      return { month: m, date: d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) };
    });
  };

  const visits = calcVisits(contract.startDate);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
            <h2 className="text-lg font-bold text-gray-800">Generar Documentos de Mantenimiento</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none">×</button>
          </div>

          {/* Tabs */}
          <div className="flex border-b flex-shrink-0">
            <button
              onClick={() => setTab('contract')}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'contract'
                ? 'border-b-2 border-green-600 text-green-700 bg-green-50'
                : 'text-gray-500 hover:text-gray-700'}`}
            >
              🔧 Contrato de Mantenimiento (2 años)
            </button>
            <button
              onClick={() => setTab('permit')}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'permit'
                ? 'border-b-2 border-blue-600 text-blue-700 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'}`}
            >
              🏛️ Permiso de Operación (DEP 4081)
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
              </div>
            ) : tab === 'contract' ? (

              /* ── CONTRATO DE MANTENIMIENTO ── */
              <div className="space-y-5">
                <p className="text-xs text-gray-500 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  Revisá y editá los campos antes de generar. Los datos se completaron automáticamente desde el Permit.
                </p>

                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Cliente</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nombre del cliente" name="customerName" value={contract.customerName} onChange={handleContractChange} />
                    <Field label="Dirección de la propiedad" name="propertyAddress" value={contract.propertyAddress} onChange={handleContractChange} />
                    <Field label="Ciudad" name="customerCity" value={contract.customerCity} onChange={handleContractChange} half />
                    <Field label="Estado" name="customerState" value={contract.customerState} onChange={handleContractChange} half />
                    <Field label="ZIP" name="customerZip" value={contract.customerZip} onChange={handleContractChange} half />
                    <Field label="Teléfono" name="customerPhone" value={contract.customerPhone} onChange={handleContractChange} half />
                    <Field label="Email" name="customerEmail" value={contract.customerEmail} onChange={handleContractChange} type="email" />
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Sistema</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Modelo del sistema" name="systemModel" value={contract.systemModel} onChange={handleContractChange} half />
                    <Field label="Número de serie" name="serialNumber" value={contract.serialNumber} onChange={handleContractChange} half />
                    <Field label="Lot" name="lot" value={contract.lot} onChange={handleContractChange} half />
                    <Field label="Block" name="block" value={contract.block} onChange={handleContractChange} half />
                    <Field label="Subdivision" name="subdivision" value={contract.subdivision} onChange={handleContractChange} />
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Fechas de visitas</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Fecha inicio (System Start-Up Date)"
                      name="startDate"
                      value={contract.startDate}
                      onChange={handleContractChange}
                      type="date"
                    />
                  </div>

                  {visits.length > 0 && (
                    <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-green-700 mb-2">Fechas de visita calculadas:</p>
                      <div className="grid grid-cols-4 gap-2">
                        {visits.map(v => (
                          <div key={v.month} className="text-center bg-white rounded border border-green-200 p-2">
                            <p className="text-xs text-gray-500">Mes {v.month}</p>
                            <p className="text-sm font-bold text-green-700">{v.date}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Estado de envío y firma */}
                {work?.maintenanceContractSentAt && (
                  <div className="space-y-2">
                    {/* Firmado */}
                    {(work?.maintenanceContractSignedAt || signatureStatus?.isSigned) ? (
                      <div className="bg-green-50 border border-green-300 rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
                        <span className="text-green-600 text-base">✅</span>
                        <span className="text-green-800 flex-1">
                          Contrato <strong>firmado</strong> el{' '}
                          {new Date(work?.maintenanceContractSignedAt || signatureStatus?.signedAt).toLocaleDateString('es-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                        {(work?.maintenanceContractSignedUrl || signatureStatus?.signedUrl) && (
                          <a
                            href={work?.maintenanceContractSignedUrl || signatureStatus?.signedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-700 underline text-xs font-medium"
                          >
                            Ver firmado
                          </a>
                        )}
                      </div>
                    ) : (
                      /* Enviado, pendiente de firma */
                      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
                        <span className="text-blue-600">📨</span>
                        <span className="text-blue-800 flex-1">
                          Enviado para firma a <strong>{work.maintenanceContractSentEmail}</strong> el{' '}
                          {new Date(work.maintenanceContractSentAt).toLocaleDateString('es-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          {work?.maintenanceContractSignatureMethod && (
                            <span className="ml-1 text-blue-500 text-xs">({work.maintenanceContractSignatureMethod === 'docusign' ? 'DocuSign' : 'SignNow'})</span>
                          )}
                        </span>
                        <button
                          onClick={handleCheckSignature}
                          disabled={checkingSignature}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded font-medium disabled:opacity-50 whitespace-nowrap"
                        >
                          {checkingSignature ? 'Verificando...' : 'Verificar firma'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

            ) : (

              /* ── PERMISO DE OPERACIÓN ── */
              <div className="space-y-5">
                <p className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  Revisá y editá los campos del formulario DEP 4081 antes de generar.
                </p>

                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Propiedad</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Dirección de la propiedad" name="propertyAddress" value={permit.propertyAddress} onChange={handlePermitChange} />
                    <Field label="Ciudad" name="propertyCity" value={permit.propertyCity} onChange={handlePermitChange} half />
                    <Field label="Estado" name="propertyState" value={permit.propertyState} onChange={handlePermitChange} half />
                    <Field label="ZIP" name="propertyZip" value={permit.propertyZip} onChange={handlePermitChange} half />
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Propietario</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nombre del propietario" name="ownerName" value={permit.ownerName} onChange={handlePermitChange} half />
                    <Field label="Teléfono" name="ownerPhone" value={permit.ownerPhone} onChange={handlePermitChange} half />
                    <Field label="Email" name="ownerEmail" value={permit.ownerEmail} onChange={handlePermitChange} type="email" />
                    <Field label="Dirección del propietario" name="ownerAddress" value={permit.ownerAddress} onChange={handlePermitChange} />
                    <Field label="Ciudad" name="ownerCity" value={permit.ownerCity} onChange={handlePermitChange} half />
                    <Field label="ZIP" name="ownerZip" value={permit.ownerZip} onChange={handlePermitChange} half />
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Información legal</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Lot" name="lot" value={permit.lot} onChange={handlePermitChange} half />
                    <Field label="Block" name="block" value={permit.block} onChange={handlePermitChange} half />
                    <Field label="Subdivision" name="subdivision" value={permit.subdivision} onChange={handlePermitChange} half />
                    <Field label="Section" name="section" value={permit.section} onChange={handlePermitChange} half />
                    <Field label="Township" name="township" value={permit.township} onChange={handlePermitChange} half />
                    <Field label="Range" name="range" value={permit.range} onChange={handlePermitChange} half />
                    <Field label="Parcel No." name="parcelNo" value={permit.parcelNo} onChange={handlePermitChange} half />
                    <Field label="Application No." name="applicationNumber" value={permit.applicationNumber} onChange={handlePermitChange} half />
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Sistema de tratamiento</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Fabricante" name="systemManufacturer" value={permit.systemManufacturer} onChange={handlePermitChange} half />
                    <Field label="Modelo" name="systemModel" value={permit.systemModel} onChange={handlePermitChange} half />
                    <Field label="Capacidad tanque (galones)" name="septicTankGallons" value={permit.septicTankGallons} onChange={handlePermitChange} half />
                    <Field label="Drainfield (sq ft)" name="drainfieldSqFt" value={permit.drainfieldSqFt} onChange={handlePermitChange} half />
                    <Field label="Fecha de instalación" name="installationDate" value={permit.installationDate} onChange={handlePermitChange} type="date" />
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Detalles del sistema</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Drainfield type */}
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de drainfield</label>
                      <select name="drainfieldType" value={permit.drainfieldType} onChange={handlePermitChange}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                        <option value="standard_subsurface">Standard Subsurface</option>
                        <option value="filled">Filled</option>
                        <option value="mound">Mound System</option>
                      </select>
                    </div>
                    {/* Drainfield config */}
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Configuración del drainfield</label>
                      <select name="drainfieldConfig" value={permit.drainfieldConfig} onChange={handlePermitChange}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                        <option value="trenches">Trenches</option>
                        <option value="bed">Bed</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    {/* Onsite Well */}
                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Onsite Well</label>
                      <select name="onsiteWell" value={permit.onsiteWell} onChange={handlePermitChange}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                    {/* Additional Comments */}
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Additional Comments</label>
                      <input type="text" name="additionalComments" value={permit.additionalComments} onChange={handlePermitChange}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 flex-shrink-0 gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
              Cerrar
            </button>

            <div className="flex gap-2">
              {tab === 'contract' && work?.maintenanceServiceUrl && (
                <button
                  onClick={() => setShowSendModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Enviar para firma
                </button>
              )}

              <button
                onClick={tab === 'contract' ? handleGenerateContract : handleGeneratePermit}
                disabled={generating}
                className={`inline-flex items-center gap-2 px-5 py-2 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                  tab === 'contract'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {generating ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Generando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {work?.[tab === 'contract' ? 'maintenanceServiceUrl' : 'operatingPermitUrl']
                      ? 'Regenerar PDF'
                      : 'Generar PDF'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal envío por email */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-gray-800 mb-4">Enviar contrato para firma</h3>
            <p className="text-xs text-gray-500 mb-4">
              Se enviará el PDF del contrato al email indicado. El cliente deberá firmarlo y devolverlo.
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre del cliente</label>
                <input
                  type="text"
                  value={sendName}
                  onChange={e => setSendName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email del cliente *</label>
                <input
                  type="email"
                  value={sendEmail}
                  onChange={e => setSendEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="cliente@email.com"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSendModal(false)}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSendToClient}
                disabled={sendingEmail || !sendEmail}
                className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
              >
                {sendingEmail ? 'Enviando...' : '✉️ Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GenerateDocumentsModal;
