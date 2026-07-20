const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { CustomInvoice } = require('../data');
const { generateCustomInvoicePdf } = require('../utils/pdfGenerators/customInvoicePdfGenerator');
const { sendEmail } = require('../utils/notifications/emailService');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function _generateInvoiceNumber(invoiceType, year, overrideNumber) {
  if (overrideNumber) {
    const exists = await CustomInvoice.findOne({ where: { invoiceNumber: overrideNumber } });
    if (exists) throw new Error(`Invoice number "${overrideNumber}" already exists`);
    return { invoiceNumber: overrideNumber, sequenceNumber: 0 };
  }

  const last = await CustomInvoice.findOne({
    where: { invoiceType, year },
    order: [['sequenceNumber', 'DESC']],
  });
  const nextSeq = last ? last.sequenceNumber + 1 : 1;
  const seqStr = nextSeq.toString().padStart(3, '0');
  return { invoiceNumber: `${invoiceType}-${year}-${seqStr}`, sequenceNumber: nextSeq };
}

function _computeTotals(items = [], discountAmount = 0, taxRate = 0) {
  const subtotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 1;
    const price = parseFloat(item.unitPrice) || 0;
    const amt = parseFloat(item.amount) || qty * price;
    return sum + amt;
  }, 0);
  const disc = parseFloat(discountAmount) || 0;
  const rate = parseFloat(taxRate) || 0;
  const afterDiscount = subtotal - disc;
  const taxAmount = afterDiscount * (rate / 100);
  const total = afterDiscount + taxAmount;
  return {
    subtotal: +subtotal.toFixed(2),
    taxAmount: +taxAmount.toFixed(2),
    total: +total.toFixed(2),
  };
}

// ── Controllers ───────────────────────────────────────────────────────────────

// POST /custom-invoices
const createInvoice = async (req, res) => {
  try {
    const staffId = req.staff?.id || req.staff?.idStaff;
    const {
      invoiceType = 'INV',
      overrideNumber,
      title,
      clientName,
      clientEmail,
      clientPhone,
      clientAddress,
      clientCompany,
      companyName,
      companyEmail,
      companyPhone,
      companyAddress,
      items = [],
      discountAmount = 0,
      discountDescription,
      taxRate = 0,
      termsAndConditions,
      priceDisplay = 'prices',
      notes,
      issueDate,
      dueDate,
      budgetId,
      workId,
      requireSignature = false,
      requirePayment = false,
      paymentPercentage = 100,
    } = req.body;

    if (!clientName) return res.status(400).json({ error: true, message: 'clientName es requerido' });
    if (!items.length) return res.status(400).json({ error: true, message: 'Se requiere al menos un item' });

    const year = issueDate ? new Date(issueDate).getFullYear() : new Date().getFullYear();
    const { invoiceNumber, sequenceNumber } = await _generateInvoiceNumber(invoiceType, year, overrideNumber);

    const { subtotal, taxAmount, total } = _computeTotals(items, discountAmount, taxRate);
    const payAmt = +(total * (parseFloat(paymentPercentage) / 100)).toFixed(2);

    const invoice = await CustomInvoice.create({
      invoiceType,
      invoiceNumber,
      sequenceNumber,
      year,
      title,
      clientName,
      clientEmail,
      clientPhone,
      clientAddress,
      clientCompany,
      companyName: companyName || 'ZURCHER CONSTRUCTION',
      companyEmail: companyEmail || 'admin@zurcherseptic.com',
      companyPhone: companyPhone || '+1 (954) 636-8200',
      companyAddress: companyAddress || 'SEPTIC TANK DIVISION - CFC1433240',
      items,
      subtotal,
      discountAmount: parseFloat(discountAmount) || 0,
      discountDescription,
      taxRate: parseFloat(taxRate) || 0,
      taxAmount,
      total,
      termsAndConditions,
      priceDisplay,
      notes,
      issueDate: issueDate || new Date().toISOString().split('T')[0],
      dueDate,
      budgetId,
      workId,
      requireSignature,
      requirePayment,
      paymentPercentage: parseFloat(paymentPercentage) || 100,
      paymentAmount: payAmt,
      status: 'draft',
      publicToken: uuidv4(),
      createdByStaffId: staffId,
    });

    res.status(201).json({ error: false, data: invoice });
  } catch (err) {
    console.error('❌ createInvoice:', err);
    res.status(500).json({ error: true, message: err.message });
  }
};

// GET /custom-invoices
const listInvoices = async (req, res) => {
  try {
    const { status, invoiceType, year, search } = req.query;
    const where = {};
    if (status) where.status = status;
    if (invoiceType) where.invoiceType = invoiceType;
    if (year) where.year = parseInt(year);
    if (search) {
      where[Op.or] = [
        { clientName: { [Op.iLike]: `%${search}%` } },
        { invoiceNumber: { [Op.iLike]: `%${search}%` } },
        { clientEmail: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const invoices = await CustomInvoice.findAll({
      where,
      order: [['createdAt', 'DESC']],
      attributes: {
        exclude: ['termsAndConditions', 'items'],
      },
    });
    res.json({ error: false, data: invoices });
  } catch (err) {
    console.error('❌ listInvoices:', err);
    res.status(500).json({ error: true, message: err.message });
  }
};

// GET /custom-invoices/:id
const getInvoice = async (req, res) => {
  try {
    const invoice = await CustomInvoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ error: true, message: 'Invoice no encontrado' });
    res.json({ error: false, data: invoice });
  } catch (err) {
    console.error('❌ getInvoice:', err);
    res.status(500).json({ error: true, message: err.message });
  }
};

// PUT /custom-invoices/:id
const updateInvoice = async (req, res) => {
  try {
    const invoice = await CustomInvoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ error: true, message: 'Invoice no encontrado' });
    if (['signed', 'paid', 'void'].includes(invoice.status)) {
      return res.status(400).json({ error: true, message: 'No se puede editar un invoice en estado: ' + invoice.status });
    }

    const {
      title, clientName, clientEmail, clientPhone, clientAddress, clientCompany,
      companyName, companyEmail, companyPhone, companyAddress,
      items, discountAmount, discountDescription, taxRate,
      termsAndConditions, priceDisplay, notes, dueDate,
      requireSignature, requirePayment, paymentPercentage,
    } = req.body;

    const updItems = items || invoice.items;
    const { subtotal, taxAmount, total } = _computeTotals(
      updItems,
      discountAmount !== undefined ? discountAmount : invoice.discountAmount,
      taxRate !== undefined ? taxRate : invoice.taxRate,
    );
    const pct = paymentPercentage !== undefined ? parseFloat(paymentPercentage) : parseFloat(invoice.paymentPercentage);
    const payAmt = +(total * pct / 100).toFixed(2);

    await invoice.update({
      ...(title !== undefined && { title }),
      ...(clientName && { clientName }),
      ...(clientEmail !== undefined && { clientEmail }),
      ...(clientPhone !== undefined && { clientPhone }),
      ...(clientAddress !== undefined && { clientAddress }),
      ...(clientCompany !== undefined && { clientCompany }),
      ...(companyName && { companyName }),
      ...(companyEmail !== undefined && { companyEmail }),
      ...(companyPhone !== undefined && { companyPhone }),
      ...(companyAddress !== undefined && { companyAddress }),
      items: updItems,
      subtotal,
      ...(discountAmount !== undefined && { discountAmount: parseFloat(discountAmount) }),
      ...(discountDescription !== undefined && { discountDescription }),
      ...(taxRate !== undefined && { taxRate: parseFloat(taxRate) }),
      taxAmount,
      total,
      ...(termsAndConditions !== undefined && { termsAndConditions }),
      ...(priceDisplay !== undefined && { priceDisplay }),
      ...(notes !== undefined && { notes }),
      ...(dueDate !== undefined && { dueDate }),
      ...(requireSignature !== undefined && { requireSignature }),
      ...(requirePayment !== undefined && { requirePayment }),
      ...(paymentPercentage !== undefined && { paymentPercentage: pct }),
      paymentAmount: payAmt,
      pdfPath: null, // force PDF regen
    });

    res.json({ error: false, data: invoice });
  } catch (err) {
    console.error('❌ updateInvoice:', err);
    res.status(500).json({ error: true, message: err.message });
  }
};

// DELETE /custom-invoices/:id
const deleteInvoice = async (req, res) => {
  try {
    const invoice = await CustomInvoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ error: true, message: 'Invoice no encontrado' });
    if (invoice.pdfPath && fs.existsSync(invoice.pdfPath)) fs.unlinkSync(invoice.pdfPath);
    await invoice.destroy();
    res.json({ error: false, message: 'Invoice eliminado' });
  } catch (err) {
    console.error('❌ deleteInvoice:', err);
    res.status(500).json({ error: true, message: err.message });
  }
};

// POST /custom-invoices/:id/generate-pdf
const generatePdf = async (req, res) => {
  try {
    const invoice = await CustomInvoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ error: true, message: 'Invoice no encontrado' });

    const pdfPath = await generateCustomInvoicePdf(invoice.toJSON());
    await invoice.update({ pdfPath });

    res.json({ error: false, data: { pdfPath } });
  } catch (err) {
    console.error('❌ generatePdf:', err);
    res.status(500).json({ error: true, message: err.message });
  }
};

// GET /custom-invoices/:id/download
const downloadPdf = async (req, res) => {
  try {
    const invoice = await CustomInvoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ error: true, message: 'Invoice no encontrado' });

    let pdfPath = invoice.pdfPath;
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      pdfPath = await generateCustomInvoicePdf(invoice.toJSON());
      await invoice.update({ pdfPath });
    }

    const safeNum = (invoice.invoiceNumber || invoice.id).replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeNum}.pdf"`);
    fs.createReadStream(pdfPath).pipe(res);
  } catch (err) {
    console.error('❌ downloadPdf:', err);
    res.status(500).json({ error: true, message: err.message });
  }
};

// POST /custom-invoices/:id/send
const sendInvoice = async (req, res) => {
  try {
    const invoice = await CustomInvoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ error: true, message: 'Invoice no encontrado' });
    if (!invoice.clientEmail) return res.status(400).json({ error: true, message: 'Invoice no tiene email de cliente' });

    // Generate PDF if needed
    let pdfPath = invoice.pdfPath;
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      pdfPath = await generateCustomInvoicePdf(invoice.toJSON());
      await invoice.update({ pdfPath });
    }

    // Auto-create Stripe link if payment required and not yet generated
    let paymentUrl = invoice.stripePaymentLinkUrl;
    if (invoice.requirePayment && !paymentUrl && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const payAmt = parseFloat(invoice.paymentAmount || invoice.total || 0);
        if (payAmt > 0) {
          const baseUrl = (process.env.FRONTEND_URL || 'https://www.zurcherseptic.com').replace(/\/$/, '');
          const amountWithFee = Math.round(payAmt * 1.03 * 100);
          const product = await stripe.products.create({
            name: `${invoice.invoiceNumber} - ${invoice.clientName}`,
            metadata: { custom_invoice_id: invoice.id, invoice_number: invoice.invoiceNumber },
          });
          const price = await stripe.prices.create({ product: product.id, unit_amount: amountWithFee, currency: 'usd' });
          const paymentLink = await stripe.paymentLinks.create({
            line_items: [{ price: price.id, quantity: 1 }],
            customer_creation: 'always',
            after_completion: { type: 'redirect', redirect: { url: `${baseUrl}/thank-you?session_id={CHECKOUT_SESSION_ID}&source=stripe` } },
            payment_intent_data: { metadata: { custom_invoice_id: invoice.id } },
          });
          paymentUrl = paymentLink.url;
          await invoice.update({ stripePaymentLinkId: paymentLink.id, stripePaymentLinkUrl: paymentUrl });
        }
      } catch (stripeErr) {
        console.error('⚠️ Stripe link auto-creation failed:', stripeErr.message);
      }
    }

    let frontendUrl = process.env.FRONTEND_URL || '';
    if (!frontendUrl || (process.env.NODE_ENV === 'production' && frontendUrl.includes('localhost'))) {
      frontendUrl = 'https://www.zurcherseptic.com';
    }
    frontendUrl = frontendUrl.replace(/\/$/, '');
    const publicUrl  = `${frontendUrl}/invoice/${invoice.publicToken}`;
    const typeLabel  = { INV: 'Invoice', QUO: 'Budget', PRO: 'Proforma', CRN: 'Credit Note', REC: 'Receipt' }[invoice.invoiceType] || 'Document';
    const total  = parseFloat(invoice.total || 0);
    const payAmt = parseFloat(invoice.paymentAmount || total);
    const pct    = parseFloat(invoice.paymentPercentage || 100);

    // Build action buttons based on what the invoice requires
    let buttonsHtml = '';
    if (invoice.requirePayment && paymentUrl) {
      const payLabel = pct >= 100
        ? `Pay Total: $${total.toFixed(2)}`
        : `Pay Initial Deposit (${pct}%): $${payAmt.toFixed(2)}`;
      buttonsHtml += `
        <a href="${paymentUrl}"
           style="background:#16a34a;color:white;padding:14px 28px;text-decoration:none;
                  border-radius:6px;display:inline-block;font-size:16px;font-weight:bold;margin:6px;">
          &#x1F4B3; ${payLabel}
        </a>`;
    }
    if (invoice.requireSignature) {
      buttonsHtml += `
        <a href="${publicUrl}"
           style="background:#063260;color:white;padding:14px 28px;text-decoration:none;
                  border-radius:6px;display:inline-block;font-size:16px;font-weight:bold;margin:6px;">
          &#x270D; Review &amp; Sign
        </a>`;
    }

    await sendEmail({
      to: invoice.clientEmail,
      subject: `${typeLabel} ${invoice.invoiceNumber} - Zurcher Construction`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
          <div style="background:#063260;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
            <h1 style="color:white;margin:0;font-size:22px;">Zurcher Construction</h1>
            <p style="color:#9bb8d8;margin:4px 0 0;font-size:13px;">SEPTIC TANK DIVISION &middot; CFC1433240</p>
          </div>
          <div style="background:#f9fafb;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <p style="font-size:16px;margin-top:0;">Dear <strong>${invoice.clientName}</strong>,</p>
            <p>Please find your <strong>${typeLabel} ${invoice.invoiceNumber}</strong> attached to this email.</p>
            ${total > 0 ? `
            <div style="background:white;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:20px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Total Amount</p>
              <p style="margin:4px 0 0;font-size:30px;font-weight:bold;color:#063260;">$${total.toFixed(2)}</p>
              ${invoice.requirePayment && pct < 100
                ? `<p style="margin:6px 0 0;font-size:13px;color:#16a34a;">&#10003; Initial deposit required: $${payAmt.toFixed(2)} (${pct}%)</p>`
                : ''}
            </div>` : ''}
            ${buttonsHtml ? `<div style="text-align:center;margin:28px 0;">${buttonsHtml}</div>` : ''}
            ${invoice.notes ? `<p style="font-size:13px;color:#555;border-top:1px solid #e5e7eb;padding-top:16px;">${invoice.notes}</p>` : ''}
            <p style="font-size:13px;color:#6b7280;margin-bottom:0;">
              Best regards,<br><strong>Zurcher Construction</strong><br>
              admin@zurcherseptic.com &nbsp;|&nbsp; +1 (954) 636-8200
            </p>
          </div>
        </div>
      `,
      attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, path: pdfPath }],
    });

    await invoice.update({ status: 'sent', sentAt: new Date() });
    res.json({ error: false, message: 'Invoice enviado exitosamente', data: { publicUrl, paymentUrl } });
  } catch (err) {
    console.error('❌ sendInvoice:', err);
    res.status(500).json({ error: true, message: err.message });
  }
};

// POST /custom-invoices/:id/send-for-signature
const sendForSignature = async (req, res) => {
  try {
    const invoice = await CustomInvoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ error: true, message: 'Invoice no encontrado' });
    if (!invoice.clientEmail) return res.status(400).json({ error: true, message: 'Invoice no tiene email de cliente' });

    // Generate PDF
    let pdfPath = invoice.pdfPath;
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      pdfPath = await generateCustomInvoicePdf(invoice.toJSON());
      await invoice.update({ pdfPath });
    }

    const DocuSignService = require('../services/ServiceDocuSign');
    const docuSignService = new DocuSignService();

    const typeLabel = { INV: 'Invoice', QUO: 'Quote', PRO: 'Proforma', CRN: 'Credit Note', REC: 'Receipt' }[invoice.invoiceType] || 'Document';
    const signResult = await docuSignService.sendBudgetForSignature(
      pdfPath,
      invoice.clientEmail,
      invoice.clientName,
      `${invoice.invoiceNumber}.pdf`,
      `Please sign ${typeLabel} ${invoice.invoiceNumber} - Zurcher Construction`,
      `Dear ${invoice.clientName},\n\nPlease review and sign the attached ${typeLabel.toLowerCase()}.\n\nBest regards,\nZurcher Construction`,
      false
    );

    let frontendUrl = process.env.FRONTEND_URL || '';
    if (!frontendUrl || (process.env.NODE_ENV === 'production' && frontendUrl.includes('localhost'))) {
      frontendUrl = 'https://www.zurcherseptic.com';
    }
    frontendUrl = frontendUrl.replace(/\/$/, '');
    const signUrl = `${frontendUrl}/invoice/${invoice.publicToken}`;

    await sendEmail({
      to: invoice.clientEmail,
      subject: `Sign Your ${typeLabel} ${invoice.invoiceNumber} - Zurcher Construction`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #063260;">${typeLabel} Ready for Signature</h2>
          <p>Dear ${invoice.clientName},</p>
          <p>Your ${typeLabel.toLowerCase()} <strong>${invoice.invoiceNumber}</strong> is ready to be signed.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${signUrl}"
               style="background-color: #4CAF50; color: white; padding: 14px 28px;
                      text-decoration: none; border-radius: 4px; display: inline-block; font-size: 16px;">
              Sign Document
            </a>
          </div>
          <p>Best regards,<br><strong>Zurcher Construction</strong></p>
        </div>
      `,
    });

    await invoice.update({
      docuSignEnvelopeId: signResult.envelopeId,
      docuSignStatus: 'sent',
      status: 'sent',
      sentAt: new Date(),
    });

    res.json({ error: false, message: 'Documento enviado para firma', data: { envelopeId: signResult.envelopeId } });
  } catch (err) {
    console.error('❌ sendForSignature:', err);
    res.status(500).json({ error: true, message: err.message });
  }
};

// POST /custom-invoices/:id/create-payment-link
const createPaymentLink = async (req, res) => {
  try {
    const invoice = await CustomInvoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ error: true, message: 'Invoice no encontrado' });

    const payAmt = parseFloat(invoice.paymentAmount || invoice.total || 0);
    if (payAmt <= 0) return res.status(400).json({ error: true, message: 'Monto de pago inválido' });
    if (!process.env.STRIPE_SECRET_KEY) return res.status(400).json({ error: true, message: 'Stripe no configurado' });

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const frontendUrl = (process.env.FRONTEND_URL || 'https://www.zurcherseptic.com').replace(/\/$/, '');
    const thankYouUrl = `${frontendUrl}/thank-you?session_id={CHECKOUT_SESSION_ID}&source=stripe`;
    const amountWithFee = Math.round(payAmt * 1.03 * 100);

    const product = await stripe.products.create({
      name: `${invoice.invoiceNumber} - ${invoice.clientName}`,
      metadata: { custom_invoice_id: invoice.id, invoice_number: invoice.invoiceNumber },
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: amountWithFee,
      currency: 'usd',
    });
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      customer_creation: 'always',
      after_completion: { type: 'redirect', redirect: { url: thankYouUrl } },
      payment_intent_data: {
        description: `Payment for ${invoice.invoiceNumber}`,
        metadata: { custom_invoice_id: invoice.id, invoice_number: invoice.invoiceNumber },
      },
    });

    await invoice.update({
      stripePaymentLinkId: paymentLink.id,
      stripePaymentLinkUrl: paymentLink.url,
    });

    res.json({ error: false, data: { url: paymentLink.url, id: paymentLink.id } });
  } catch (err) {
    console.error('❌ createPaymentLink:', err);
    res.status(500).json({ error: true, message: err.message });
  }
};

// GET /invoice/:token  (public, no auth)
const publicView = async (req, res) => {
  try {
    const invoice = await CustomInvoice.findOne({
      where: { publicToken: req.params.token },
    });
    if (!invoice) return res.status(404).json({ error: true, message: 'Invoice no encontrado' });

    // Track first view
    if (!invoice.viewedAt) {
      await invoice.update({ viewedAt: new Date(), status: invoice.status === 'sent' ? 'viewed' : invoice.status });
    }

    // Return safe fields (exclude internal IDs etc.)
    const data = invoice.toJSON();
    delete data.pdfPath;
    delete data.createdByStaffId;
    delete data.stripePaymentLinkId;
    delete data.stripeSessionId;
    delete data.docuSignEnvelopeId;

    res.json({ error: false, data });
  } catch (err) {
    console.error('❌ publicView:', err);
    res.status(500).json({ error: true, message: err.message });
  }
};

// POST /invoice/:token/approve  (public)
const clientApprove = async (req, res) => {
  try {
    const invoice = await CustomInvoice.findOne({ where: { publicToken: req.params.token } });
    if (!invoice) return res.status(404).json({ error: true, message: 'Invoice no encontrado' });

    if (['approved', 'signed', 'paid', 'void'].includes(invoice.status)) {
      return res.json({ error: false, message: 'Invoice ya fue procesado', data: { status: invoice.status } });
    }

    await invoice.update({ status: 'approved', approvedAt: new Date() });
    res.json({ error: false, message: 'Invoice aprobado', data: { status: 'approved' } });
  } catch (err) {
    console.error('❌ clientApprove:', err);
    res.status(500).json({ error: true, message: err.message });
  }
};

// GET /custom-invoices/available-years  (used in list filter)
const getAvailableYears = async (req, res) => {
  try {
    const invoices = await CustomInvoice.findAll({ attributes: ['year'] });
    const years = [...new Set(invoices.map(i => i.year))].sort((a, b) => b - a);
    if (!years.length) years.push(new Date().getFullYear());
    res.json({ error: false, data: years });
  } catch (err) {
    console.error('❌ getAvailableYears:', err);
    res.status(500).json({ error: true, message: err.message });
  }
};

// DELETE /custom-invoices/:id/payment-link
const clearPaymentLink = async (req, res) => {
  try {
    const invoice = await CustomInvoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ error: true, message: 'Invoice no encontrado' });
    await invoice.update({ stripePaymentLinkId: null, stripePaymentLinkUrl: null, pdfPath: null });
    res.json({ error: false, message: 'Link de pago eliminado' });
  } catch (err) {
    console.error('❌ clearPaymentLink:', err);
    res.status(500).json({ error: true, message: err.message });
  }
};

module.exports = {
  createInvoice,
  listInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  generatePdf,
  downloadPdf,
  sendInvoice,
  sendForSignature,
  createPaymentLink,
  clearPaymentLink,
  publicView,
  clientApprove,
  getAvailableYears,
};
