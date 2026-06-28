/**
 * Rotte PayPal — incasso dell'ACCONTO (40% del costo notti).
 *   GET  /api/payment/config            -> { enabled, clientId, currency, mode }
 *   POST /api/payment/create-order      -> { booking_id } => { orderID }
 *   POST /api/payment/capture/:orderId  -> cattura e conferma la prenotazione
 *
 * Se PayPal non è configurato (credenziali placeholder) gli endpoint di
 * pagamento rispondono 503: il frontend ripiega sulla richiesta "pending".
 */
const express = require('express');
const db = require('../config/database');
const paypal = require('../services/paypal');

const router = express.Router();

// Espone al frontend lo stato della configurazione PayPal.
router.get('/config', (req, res) => {
  res.json({
    enabled: paypal.isEnabled(),
    clientId: paypal.isEnabled() ? paypal.getClientId() : null,
    mode: paypal.getMode(),
    currency: 'EUR',
  });
});

// Crea un ordine PayPal per l'acconto di una prenotazione pending.
router.post('/create-order', async (req, res, next) => {
  try {
    if (!paypal.isEnabled()) {
      return res.status(503).json({ error: 'Pagamento online non disponibile.' });
    }
    const { booking_id } = req.body || {};
    if (!booking_id) return res.status(400).json({ error: 'booking_id mancante.' });

    const booking = await db('bookings').where({ id: Number(booking_id) }).first();
    if (!booking) return res.status(404).json({ error: 'Prenotazione non trovata.' });
    if (booking.status !== 'pending') {
      return res.status(409).json({ error: 'Prenotazione non in attesa di pagamento.' });
    }

    const order = await paypal.createOrder({
      amount: booking.deposit_amount,
      currency: booking.currency || 'EUR',
      description: `Acconto 40% - Casa Vacanze Leonardo (prenotazione #${booking.id})`,
      reference: booking.id,
    });

    // Memorizza l'order id per riconciliazione.
    await db('bookings').where({ id: booking.id }).update({ paypal_order_id: order.id });

    res.json({ orderID: order.id });
  } catch (err) {
    next(err);
  }
});

// Cattura l'ordine approvato dall'ospite e conferma la prenotazione.
router.post('/capture/:orderId', async (req, res, next) => {
  try {
    if (!paypal.isEnabled()) {
      return res.status(503).json({ error: 'Pagamento online non disponibile.' });
    }
    const { orderId } = req.params;

    const booking = await db('bookings').where({ paypal_order_id: orderId }).first();
    if (!booking) return res.status(404).json({ error: 'Prenotazione non trovata per questo ordine.' });

    const result = await paypal.captureOrder(orderId);
    if (result.status !== 'COMPLETED') {
      return res.status(402).json({ error: 'Pagamento non completato.', status: result.status });
    }

    await db('bookings').where({ id: booking.id }).update({
      status: 'confirmed',
      paypal_capture_id: result.captureId,
      updated_at: db.fn.now(),
    });

    res.json({
      id: booking.id,
      status: 'confirmed',
      capture_id: result.captureId,
      deposit_amount: booking.deposit_amount,
      balance_due: booking.balance_due,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
