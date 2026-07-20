import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/axios';

const TYPE_LABELS = { INV: 'INVOICE', QUO: 'QUOTE', PRO: 'PROFORMA', CRN: 'CREDIT NOTE', REC: 'RECEIPT' };

const STATUS_INFO = {
  draft:    { label: 'Draft',    color: 'text-gray-500' },
  sent:     { label: 'Sent',     color: 'text-blue-600' },
  viewed:   { label: 'Viewed',   color: 'text-purple-600' },
  approved: { label: 'Approved', color: 'text-green-600' },
  signed:   { label: 'Signed',   color: 'text-emerald-600' },
  paid:     { label: 'Paid',     color: 'text-teal-600' },
  void:     { label: 'Void',     color: 'text-red-500' },
};

export default function CustomInvoicePublicView() {
  const { token } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/invoice/${token}`);
        setInvoice(data.data);
        if (data.data.status === 'approved') setApproved(true);
      } catch (err) {
        setError(err.response?.data?.message || 'Document not found');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleApprove = async () => {
    setApproving(true);
    try {
      await api.post(`/invoice/${token}/approve`);
      setApproved(true);
      setInvoice(inv => ({ ...inv, status: 'approved' }));
    } catch (err) {
      alert(err.response?.data?.message || 'Error approving');
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-8">
          <p className="text-4xl mb-4">📄</p>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Document Not Found</h2>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  const fmt = v => `$${parseFloat(v || 0).toFixed(2)}`;
  const typeLabel = TYPE_LABELS[invoice.invoiceType] || invoice.invoiceType;
  const statusInfo = STATUS_INFO[invoice.status] || { label: invoice.status, color: 'text-gray-500' };

  const fmtDate = d => {
    if (!d) return '—';
    const parts = d.split('-');
    if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
    return d;
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Status bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Status</span>
            <span className={`text-sm font-semibold ${statusInfo.color}`}>{statusInfo.label}</span>
          </div>
          {invoice.status === 'paid' && (
            <span className="bg-teal-100 text-teal-700 text-xs font-bold px-3 py-1 rounded-full">
              ✅ PAID
            </span>
          )}
        </div>

        {/* Document card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* Header */}
          <div className="p-8 border-b border-gray-100">
            <div className="flex justify-between items-start">
              {/* Company info */}
              <div>
                <h2 className="text-xl font-bold text-gray-900">{invoice.companyName}</h2>
                {invoice.companyAddress && (
                  <p className="text-sm text-gray-500 mt-0.5">{invoice.companyAddress}</p>
                )}
                {invoice.companyEmail && (
                  <p className="text-sm text-gray-500">{invoice.companyEmail}</p>
                )}
                {invoice.companyPhone && (
                  <p className="text-sm text-gray-500">{invoice.companyPhone}</p>
                )}
              </div>

              {/* Invoice info */}
              <div className="text-right">
                <h1 className="text-3xl font-black text-blue-900">{typeLabel}</h1>
                <p className="text-lg font-mono font-semibold text-gray-700">#{invoice.invoiceNumber}</p>
                {invoice.title && (
                  <p className="text-sm text-gray-400 mt-1">{invoice.title}</p>
                )}
                <div className="mt-2 text-sm text-gray-500">
                  <p>Date: <span className="text-gray-700 font-medium">{fmtDate(invoice.issueDate)}</span></p>
                  {invoice.dueDate && (
                    <p>Due: <span className="text-gray-700 font-medium">{fmtDate(invoice.dueDate)}</span></p>
                  )}
                </div>
              </div>
            </div>

            {/* Client info */}
            <div className="mt-6 pt-5 border-t border-gray-50">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Bill To</p>
              <p className="font-semibold text-gray-800">{invoice.clientName}</p>
              {invoice.clientCompany && <p className="text-sm text-gray-600">{invoice.clientCompany}</p>}
              {invoice.clientEmail && <p className="text-sm text-gray-500">{invoice.clientEmail}</p>}
              {invoice.clientPhone && <p className="text-sm text-gray-500">{invoice.clientPhone}</p>}
              {invoice.clientAddress && <p className="text-sm text-gray-500">{invoice.clientAddress}</p>}
            </div>
          </div>

          {/* Items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 font-semibold text-gray-600">Item</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Descripción</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Cant.</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Precio</th>
                  <th className="text-right px-6 py-3 font-semibold text-gray-600">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(invoice.items || []).map((item, i) => (
                  <tr key={i} className={i % 2 === 1 ? 'bg-gray-50/50' : ''}>
                    <td className="px-6 py-4 font-medium text-gray-800">{item.name}</td>
                    <td className="px-4 py-4 text-gray-500 text-xs">{item.description}</td>
                    <td className="px-4 py-4 text-right text-gray-600">{item.quantity}</td>
                    <td className="px-4 py-4 text-right text-gray-600">{fmt(item.unitPrice)}</td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-800">{fmt(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="p-8 border-t border-gray-100">
            <div className="ml-auto max-w-xs space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span><span>{fmt(invoice.subtotal)}</span>
              </div>
              {parseFloat(invoice.discountAmount || 0) > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>{invoice.discountDescription || 'Discount'}</span>
                  <span>-{fmt(invoice.discountAmount)}</span>
                </div>
              )}
              {parseFloat(invoice.taxAmount || 0) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Tax ({invoice.taxRate}%)</span><span>{fmt(invoice.taxAmount)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-gray-900 text-base">
                <span>TOTAL</span><span>{fmt(invoice.total)}</span>
              </div>
              {invoice.requirePayment && parseFloat(invoice.paymentPercentage || 100) < 100 && (
                <div className="flex justify-between text-blue-700 font-semibold">
                  <span>Payment Due ({invoice.paymentPercentage}%)</span>
                  <span>{fmt(invoice.paymentAmount)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Stripe payment button */}
          {invoice.stripePaymentLinkUrl && !['paid'].includes(invoice.status) && (
            <div className="px-8 pb-6 text-center">
              <a
                href={invoice.stripePaymentLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-blue-900 hover:bg-blue-800 text-white font-semibold px-8 py-3 rounded-xl transition text-sm"
              >
                Pay Online (includes 3% processing fee)
              </a>
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="px-8 pb-6 border-t border-gray-50 pt-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notes</p>
              <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}

          {/* Terms */}
          {invoice.termsAndConditions && (
            <div className="px-8 pb-8 border-t border-gray-50 pt-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Terms & Conditions</p>
              <p className="text-xs text-gray-500 whitespace-pre-line leading-relaxed">
                {invoice.termsAndConditions}
              </p>
            </div>
          )}
        </div>

        {/* Approve button */}
        {!['approved', 'signed', 'paid', 'void'].includes(invoice.status) && (
          <div className="mt-6 text-center">
            {approved ? (
              <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-4 inline-block">
                <p className="text-green-700 font-semibold">✅ Document Approved</p>
                <p className="text-sm text-green-600">Thank you for your approval.</p>
              </div>
            ) : (
              <button
                onClick={handleApprove}
                disabled={approving}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold px-10 py-3 rounded-xl transition disabled:opacity-50 text-sm"
              >
                {approving ? 'Processing...' : 'Approve This Document'}
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-8">
          Powered by Zurcher Construction · admin@zurcherseptic.com
        </p>
      </div>
    </div>
  );
}
