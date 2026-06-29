/**
 * Rotte API pubbliche generali.
 * Per ora: /api/rooms (lista appartamenti attivi).
 * Le rotte di disponibilità/prenotazione sono in booking.js.
 */
const express = require('express');
const db = require('../config/database');
const availability = require('../services/availability');

const router = express.Router();

/**
 * Helper: normalizza una room dal DB (parsing dei campi JSON).
 */
function parseRoom(room) {
  if (!room) return room;
  return {
    ...room,
    amenities: safeParse(room.amenities, []),
    images: safeParse(room.images, []),
  };
}

function safeParse(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value; // PostgreSQL può restituire già oggetti
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

// GET /api/rooms — lista appartamenti attivi
router.get('/rooms', async (req, res, next) => {
  try {
    const rooms = await db('rooms').where({ is_active: true }).orderBy('id');
    res.json(rooms.map(parseRoom));
  } catch (err) {
    next(err);
  }
});

// GET /api/rooms/:idOrSlug — dettaglio appartamento
router.get('/rooms/:idOrSlug', async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const query = db('rooms').where({ is_active: true });
    if (/^\d+$/.test(idOrSlug)) {
      query.andWhere({ id: Number(idOrSlug) });
    } else {
      query.andWhere({ slug: idOrSlug });
    }
    const room = await query.first();
    if (!room) return res.status(404).json({ error: 'Appartamento non trovato' });

    const seasons = await db('seasons')
      .where({ room_id: room.id, is_active: true })
      .select('name', 'price_per_night', 'months');

    res.json({
      ...parseRoom(room),
      seasons: seasons.map((s) => ({ ...s, months: safeParse(s.months, []) })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/availability?room=&from=&to=[&check_in=&check_out=]
// Ritorna le date non disponibili nell'intervallo, info tariffarie e,
// se forniti check_in/check_out, anche il preventivo del soggiorno.
router.get('/availability', async (req, res, next) => {
  try {
    const roomKey = req.query.room || req.query.room_id || 'casa-vacanze-leonardo';
    const room = await availability.getRoom(roomKey);
    if (!room) return res.status(404).json({ error: 'Appartamento non trovato' });

    const seasons = await availability.getSeasons(room.id);

    // Intervallo: default da oggi a +18 mesi.
    const today = availability.toISO(new Date());
    const from = req.query.from || today;
    let to = req.query.to;
    if (!to) {
      const d = availability.parseDate(from) || new Date();
      d.setUTCMonth(d.getUTCMonth() + 18);
      to = availability.toISO(d);
    }

    const unavailableSet = await availability.getUnavailableDates(room.id, from, to);
    const pendingSet = await availability.getPendingDates(room.id, from, to);

    const result = {
      room_id: room.id,
      slug: room.slug,
      min_nights: room.min_nights,
      capacity: room.capacity,
      cleaning_fee: Number(room.cleaning_fee),
      security_deposit: Number(room.security_deposit),
      deposit_percent: Number(room.deposit_percent),
      default_price: Number(room.default_price),
      seasons,
      from,
      to,
      unavailable: Array.from(unavailableSet).sort(),
      // Date con richieste in attesa (non bloccano: selezionabili, ma segnalate).
      pending: Array.from(pendingSet).sort(),
    };

    // Preventivo opzionale.
    if (req.query.check_in && req.query.check_out) {
      try {
        const quote = availability.computeQuote(room, seasons, req.query.check_in, req.query.check_out);
        quote.available = availability.rangeIsFree(req.query.check_in, req.query.check_out, unavailableSet);
        result.quote = quote;
      } catch (e) {
        result.quote = { error: e.message };
      }
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.parseRoom = parseRoom;
module.exports.safeParse = safeParse;
