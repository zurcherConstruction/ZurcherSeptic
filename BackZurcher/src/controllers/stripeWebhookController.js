/**
 * 🎯 STRIPE WEBHOOK CONTROLLER
 * Maneja las notificaciones automáticas de Stripe cuando ocurren pagos
 * 
 * Eventos importantes:
 * - checkout.session.completed: Cuando se completa un pago
 * - payment_intent.succeeded: Cuando un pago es exitoso
 * - payment_intent.payment_failed: Cuando un pago falla
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Income, Budget, Work, FinalInvoice } = require('../data');
const { sendNotification } = require('../utils/notifications/notificationService');
const { sendNotificationToApp } = require('../utils/notifications/notificationServiceApp');
const { filterDuplicates, registerSent } = require('../utils/notifications/notificationDeduplicator');

async function getReceiptDataFromSessionId(sessionId) {
  if (!sessionId) return { receiptUrl: null, session: null };

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent.latest_charge']
  });

  const latestCharge = session?.payment_intent?.latest_charge;
  const receiptUrl = latestCharge?.receipt_url || null;

  return { receiptUrl, session };
}

/**
 * 🔔 Maneja todos los eventos de webhook de Stripe
 */
exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verificar que el evento viene de Stripe (seguridad)
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('⚠️ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('📬 Stripe Webhook recibido:', event.type);

  // ⚠️ IMPORTANTE: Siempre responder 200 a Stripe PRIMERO
  // Si no, Stripe reintentará el webhook infinitamente
  res.status(200).json({ received: true });

  // Procesar el webhook de forma asíncrona (sin bloquear la respuesta)
  // Si hay errores, los logueamos pero no afectamos la respuesta a Stripe
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;
      
      default:
        console.log(`⚡ Evento no manejado: ${event.type}`);
    }

    console.log('✅ Webhook procesado exitosamente');
  } catch (error) {
    console.error('❌ Error procesando webhook (ya respondimos 200 a Stripe):', error);
    // No lanzar el error - ya respondimos a Stripe
  }
};

/**
 * 💳 Maneja el evento cuando se completa una sesión de checkout
 */
async function handleCheckoutSessionCompleted(session) {
  console.log('✅ Checkout completado:', session.id);
  
  const metadata = session.metadata || {};
  const paymentType = metadata.payment_type;
  const amountPaid = session.amount_total / 100; // Stripe envía en centavos
  const customerEmail = session.customer_email || session.customer_details?.email;

  console.log('📊 Detalles del pago:', {
    paymentType,
    amountPaid,
    customerEmail,
    paymentIntentId: session.payment_intent,
    metadata
  });

  // Determinar el tipo de pago y procesarlo
  if (paymentType === 'invoice_payment') {
    // Pago de Budget Invoice (pago inicial)
    const budgetId = metadata.internal_budget_id;
    if (!budgetId) {
      console.error('❌ Falta internal_budget_id en metadata para invoice_payment');
      return;
    }
    await processInvoicePayment(budgetId, amountPaid, session);
    
  } else if (paymentType === 'final_invoice_payment') {
    // Pago de Final Invoice (pago final)
    const finalInvoiceId = metadata.final_invoice_id;
    const workId = metadata.work_id;
    
    if (!finalInvoiceId) {
      console.error('❌ Falta final_invoice_id en metadata para final_invoice_payment');
      return;
    }
    
    await processFinalInvoicePayment({
      finalInvoiceId,
      workId,
      budgetId: metadata.budget_id
    }, amountPaid, session);
    
  } else {
    console.warn('⚠️ Tipo de pago no reconocido:', paymentType);
    console.warn('Metadata recibida:', metadata);
  }
}

/**
 * 📋 Procesa el pago de un Invoice (Budget)
 */
async function processInvoicePayment(budgetId, amountPaid, session) {
  try {
    // Buscar el budget
    const budget = await Budget.findByPk(budgetId, {
      include: [{ association: 'Permit' }]
    });

    if (!budget) {
      console.error('❌ Budget no encontrado:', budgetId);
      return;
    }

    console.log(`💰 Procesando pago de $${amountPaid} para Budget #${budgetId}`);

    const { receiptUrl } = await getReceiptDataFromSessionId(session.id);

    // Crear registro de Income
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const income = await Income.create({
      typeIncome: 'Factura Pago Inicial Budget', // ✅ Corregido: era 'type'
      amount: amountPaid,
      date: localDate,
      notes: `Initial payment received via Stripe for Invoice #${budget.invoiceNumber || budgetId} - ${budget.Permit?.propertyAddress || budget.propertyAddress || 'N/A'}`,
      workId: null, // Budget aún no tiene Work
      staffId: null,
      paymentMethod: 'Stripe',
      stripePaymentIntentId: session.payment_intent,
      stripeSessionId: session.id,
      paymentDetails: receiptUrl
        ? `Stripe session: ${session.id} | budget_id:${budgetId} | Receipt: ${receiptUrl}`
        : `Stripe session: ${session.id} | budget_id:${budgetId}`,
      verified: false
    });

    console.log('✅ Income creado:', income.idIncome);

    // Actualizar estado del budget si es necesario
    // Si el pago es del initial payment completo, cambiar a 'paid'
    const expectedInitialPayment = parseFloat(budget.initialPayment || 0);
    const paidWithoutFee = amountPaid / 1.03; // Quitar el 3% fee para comparar
    
    if (Math.abs(paidWithoutFee - expectedInitialPayment) < 1) { // Tolerancia de $1
      await budget.update({ status: 'paid' });
      console.log(`✅ Budget #${budgetId} marcado como 'paid'`);
    }

    // 📧 Enviar notificaciones
    await sendPaymentNotifications(
      budget, 
      amountPaid, 
      'invoice', 
      session.customer_email,
      budgetId
    );

  } catch (error) {
    console.error('❌ Error procesando pago de invoice:', error);
    throw error;
  }
}

/**
 * 🧾 Procesa el pago de un Final Invoice
 */
async function processFinalInvoicePayment(metadata, amountPaid, session) {
  try {
    const { finalInvoiceId, workId, budgetId } = metadata;

    if (!finalInvoiceId) {
      console.error('❌ Falta final_invoice_id en metadata:', metadata);
      return;
    }

    console.log(`💰 Procesando pago final de $${amountPaid} para Final Invoice #${finalInvoiceId}`);

    const { receiptUrl } = await getReceiptDataFromSessionId(session.id);

    // Buscar el Final Invoice
    const finalInvoice = await FinalInvoice.findByPk(finalInvoiceId);
    
    if (!finalInvoice) {
      console.error('❌ Final Invoice no encontrado:', finalInvoiceId);
      return;
    }

    // Buscar el Work (puede venir en metadata o en el finalInvoice)
    let work = null;
    const effectiveWorkId = workId || finalInvoice.workId;
    
    if (effectiveWorkId) {
      work = await Work.findByPk(effectiveWorkId, {
        include: [{ association: 'budget' }]
      });
    }

    if (!work) {
      console.error('❌ Work no encontrado. WorkId:', effectiveWorkId);
      // Aún así podemos procesar el pago, solo que sin actualizar el work
    }

    // Crear registro de Income
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const income = await Income.create({
      typeIncome: 'Factura Pago Final Budget', // ✅ Corregido: era 'type'
      amount: amountPaid,
      date: localDate,
      notes: `Final payment received via Stripe for Final Invoice #${finalInvoiceId}${work ? ` - ${work.propertyAddress}` : ''}`,
      workId: effectiveWorkId || null,
      staffId: null,
      paymentMethod: 'Stripe',
      stripePaymentIntentId: session.payment_intent,
      stripeSessionId: session.id,
      paymentDetails: receiptUrl
        ? `Stripe session: ${session.id} | Receipt: ${receiptUrl}`
        : `Stripe session: ${session.id}`,
      verified: false
    });

    console.log('✅ Income de pago final creado:', income.idIncome);

    // Actualizar estado del Final Invoice a 'paid'
    await finalInvoice.update({ 
      status: 'paid',
      paymentDate: new Date()
    });
    
    console.log(`✅ Final Invoice #${finalInvoiceId} actualizado a 'paid'`);

    // Actualizar estado del Work si existe
    if (work) {
      await work.update({ status: 'paymentReceived' });
      console.log(`✅ Work #${work.idWork} actualizado a 'paymentReceived'`);
    }

    // 📧 Enviar notificaciones
    await sendPaymentNotifications(
      work || finalInvoice, 
      amountPaid, 
      'final_invoice', 
      session.customer_email,
      finalInvoiceId
    );

  } catch (error) {
    console.error('❌ Error procesando pago de final invoice:', error);
    throw error;
  }
}

/**
 * 📧 Envía notificaciones de pago recibido
 */
async function sendPaymentNotifications(entity, amount, type, customerEmail) {
  try {
    const propertyAddress = entity.propertyAddress || entity.Permit?.propertyAddress || 'N/A';
    const clientName = entity.applicantName || entity.Permit?.applicantName || 'Cliente';
    
    const message = type === 'invoice' 
      ? `💰 ¡Pago recibido via Stripe! $${amount.toFixed(2)} para Invoice en ${propertyAddress}`
      : `💰 ¡Pago final recibido via Stripe! $${amount.toFixed(2)} para ${propertyAddress}`;

    // Notificación al sistema web
    await sendNotification({
      title: '💳 Pago Recibido via Stripe',
      message: message,
      type: 'payment_received',
      targetRoles: ['owner', 'admin', 'finance'],
      relatedEntity: type === 'invoice' ? 'Budget' : 'Work',
      relatedEntityId: entity.idBudget || entity.idWork
    });

    // Notificación a la app móvil
    await sendNotificationToApp({
      title: '💳 Pago Stripe',
      body: message,
      targetRoles: ['owner', 'admin', 'finance'],
      data: {
        type: 'stripe_payment',
        amount: amount,
        customerEmail: customerEmail,
        paymentType: type
      }
    });

    console.log('✅ Notificaciones de pago enviadas');
  } catch (error) {
    console.error('⚠️ Error enviando notificaciones:', error);
  }
}

/**
 * ✅ Maneja pagos exitosos (redundante con checkout.session.completed, pero útil)
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
  console.log('✅ Payment intent succeeded:', paymentIntent.id);
  // Opcional: logging adicional o acciones secundarias
}

/**
 * ❌ Maneja pagos fallidos
 */
async function handlePaymentIntentFailed(paymentIntent) {
  console.log('❌ Payment intent failed:', paymentIntent.id);
  
  // Enviar notificación de pago fallido
  try {
    await sendNotification({
      title: '❌ Pago Fallido en Stripe',
      message: `Intento de pago fallido. Monto: $${(paymentIntent.amount / 100).toFixed(2)}`,
      type: 'payment_failed',
      targetRoles: ['owner', 'admin', 'finance']
    });

    await sendNotificationToApp({
      title: '❌ Pago Fallido',
      body: `Un cliente intentó pagar pero falló. Monto: $${(paymentIntent.amount / 100).toFixed(2)}`,
      targetRoles: ['owner', 'admin', 'finance'],
      data: { type: 'stripe_payment_failed', paymentIntentId: paymentIntent.id }
    });
  } catch (error) {
    console.error('⚠️ Error enviando notificación de pago fallido:', error);
  }
}

/**
 * 🧪 Endpoint de prueba para verificar que el webhook está funcionando
 */
exports.testWebhook = async (req, res) => {
  res.json({
    status: 'Webhook endpoint is working',
    timestamp: new Date().toISOString(),
    env: {
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
      hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET
    }
  });
};

/**
 * 🔎 Devuelve URL del recibo de Stripe para una Checkout Session
 * Uso esperado: /stripe/checkout-receipt?session_id=cs_test_xxx
 */
exports.getCheckoutReceipt = async (req, res) => {
  try {
    const sessionId = (req.query.session_id || '').trim();

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'session_id es requerido'
      });
    }

    const { receiptUrl, session } = await getReceiptDataFromSessionId(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Checkout session no encontrada'
      });
    }

    const isPaid = session.payment_status === 'paid';

    return res.json({
      success: true,
      sessionId: session.id,
      paymentStatus: session.payment_status,
      isPaid,
      amountTotal: typeof session.amount_total === 'number' ? session.amount_total / 100 : null,
      currency: session.currency || 'usd',
      customerEmail: session.customer_email || session.customer_details?.email || null,
      receiptUrl,
      paymentType: session.metadata?.payment_type || null,
      invoiceNumber: session.metadata?.invoice_number || null
    });
  } catch (error) {
    console.error('❌ Error consultando recibo por checkout session:', error);
    return res.status(500).json({
      success: false,
      message: 'No se pudo obtener el recibo de Stripe',
      error: error.message
    });
  }
};
