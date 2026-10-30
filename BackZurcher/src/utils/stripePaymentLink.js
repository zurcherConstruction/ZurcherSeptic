/**
 * 💳 Crea el Payment Link de Stripe de un CustomInvoice (con 3% de cargo por procesamiento)
 * y lo guarda en el invoice. El webhook de Stripe lo reconoce por metadata.custom_invoice_id
 * y marca el invoice como pagado + registra el Income.
 */
async function createCustomInvoicePaymentLink(invoice) {
  const payAmt = parseFloat(invoice.paymentAmount || invoice.total || 0);
  if (payAmt <= 0) throw new Error('Monto de pago inválido');
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Stripe no configurado');

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
    // metadata on the link → copied to checkout session → readable by webhook via session.metadata
    metadata: { custom_invoice_id: invoice.id, invoice_number: invoice.invoiceNumber },
    payment_intent_data: {
      description: `Payment for ${invoice.invoiceNumber}`,
      metadata: { custom_invoice_id: invoice.id, invoice_number: invoice.invoiceNumber },
    },
  });

  await invoice.update({
    stripePaymentLinkId: paymentLink.id,
    stripePaymentLinkUrl: paymentLink.url,
  });
  return { url: paymentLink.url, id: paymentLink.id, amountWithFee: amountWithFee / 100 };
}

module.exports = { createCustomInvoicePaymentLink };
