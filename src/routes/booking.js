/**
 * Rotte prenotazione (montate su /api/bookings).
 *   POST /api/bookings              -> crea prenotazione (pending) + preventivo
 *   GET  /api/bookings/:id          -> dettaglio prenotazione
 *
 * La disponibilità (GET /api/availability) sta nel router index.js.
 * Il pagamento dell'acconto (PayPal) è gestito separatamente in payment.js.
 */
const express = require('express');
const db = require('../config/database');
const availability = require('../services/availability');

const router = express.Router();

function isEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// POST /api/bookings — crea una prenotazione in stato "pending"
router.post('/', async (req, res, next) => {
  try {
    const {
      room: roomKey,
      check_in,
      check_out,
      guest_name,
      guest_email,
      guest_phone,
      num_guests,
      lang,
      notes,
    } = req.body || {};

    // --- Validazione campi ospite ---
    if (!guest_name || String(guest_name).trim().length < 2) {
      return res.status(400).json({ error: 'Nome non valido.' });
    }
    if (!isEmail(guest_email)) {
      return res.status(400).json({ error: 'Email non valida.' });
    }

    const room = await availability.getRoom(roomKey || 'casa-vacanze-leonardo');
    if (!room) return res.status(404).json({ error: 'Appartamento non trovato.' });

    const guests = Number(num_guests) || 1;
    if (guests < 1 || guests > Number(room.capacity)) {
      return res.status(400).json({ error: `Numero ospiti non valido (max ${room.capacity}).` });
    }

    const seasons = await availability.getSeasons(room.id);

    // --- Preventivo (valida anche date e soggiorno minimo) ---
    let quote;
    try {
      quote = availability.computeQuote(room, seasons, check_in, check_out);
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }

    // --- Verifica disponibilità (anti doppia prenotazione) ---
    const unavailable = await availability.getUnavailableDates(room.id, check_in, check_out);
    if (!availability.rangeIsFree(check_in, check_out, unavailable)) {
      return res.status(409).json({ error: 'Le date selezionate non sono più disponibili.' });
    }

    // --- Inserimento ---
    const payload = {
      room_id: room.id,
      guest_name: String(guest_name).trim(),
      guest_email: String(guest_email).trim(),
      guest_phone: guest_phone ? String(guest_phone).trim() : null,
      lang: (lang && String(lang).slice(0, 5)) || 'it',
      check_in,
      check_out,
      num_guests: guests,
      num_nights: quote.nights,
      currency: quote.currency,
      lodging_total: quote.lodging_total,
      cleaning_fee: quote.cleaning_fee,
      total_price: quote.total_price,
      deposit_amount: quote.deposit_amount,
      balance_due: quote.balance_due,
      security_deposit: quote.security_deposit,
      status: 'pending',
      notes: notes ? String(notes).slice(0, 1000) : null,
    };

    const [inserted] = await db('bookings').insert(payload).returning('id');
    const id = typeof inserted === 'object' ? inserted.id : inserted;

    res.status(201).json({ id, status: 'pending', ...payload, quote });
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings/:id — dettaglio prenotazione
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'ID non valido.' });

    const booking = await db('bookings').where({ id: Number(id) }).first();
    if (!booking) return res.status(404).json({ error: 'Prenotazione non trovata.' });

    res.json(booking);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
