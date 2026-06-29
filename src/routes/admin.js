/**
 * Rotte pannello admin (protette da sessione, tranne il login).
 *   POST   /api/admin/login
 *   POST   /api/admin/logout
 *   GET    /api/admin/me                 -> stato sessione
 *   GET    /api/admin/bookings           (protetto) - Fase 7
 *   PUT    /api/admin/bookings/:id/status(protetto) - Fase 7
 *   POST   /api/admin/blocked-dates      (protetto) - Fase 7
 *   DELETE /api/admin/blocked-dates/:id  (protetto) - Fase 7
 */
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const availability = require('../services/availability');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'];

// Normalizza un valore data a stringa 'YYYY-MM-DD' (gestisce Date e stringhe).
function dateStr(value) {
  if (!value) return value;
  if (value instanceof Date) return availability.toISO(value);
  return String(value).slice(0, 10);
}

// Risolve l'appartamento di default (sito mono-appartamento).
async function defaultRoom() {
  return availability.getRoom('casa-vacanze-leonardo');
}

// POST /api/admin/login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username e password obbligatori' });
    }
    const user = await db('admin_users').where({ username }).first();
    if (!user) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    req.session.adminId = user.id;
    req.session.username = user.username;
    res.json({ ok: true, username: user.username });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('cvl.sid');
    res.json({ ok: true });
  });
});

// GET /api/admin/me — verifica stato sessione
router.get('/me', (req, res) => {
  if (req.session && req.session.adminId) {
    return res.json({ authenticated: true, username: req.session.username });
  }
  return res.json({ authenticated: false });
});

// --- Rotte protette (Fase 7) ---

// GET /api/admin/bookings?status=&from=&to= — elenco prenotazioni
router.get('/bookings', requireAdmin, async (req, res, next) => {
  try {
    const q = db('bookings').orderBy('check_in', 'desc');
    if (req.query.status && BOOKING_STATUSES.indexOf(req.query.status) !== -1) {
      q.where('status', req.query.status);
    }
    if (req.query.from) q.andWhere('check_out', '>=', req.query.from);
    if (req.query.to) q.andWhere('check_in', '<=', req.query.to);
    const rows = await q;
    const bookings = rows.map((b) => ({
      ...b,
      check_in: dateStr(b.check_in),
      check_out: dateStr(b.check_out),
    }));
    // Riepilogo conteggi per stato.
    const stats = BOOKING_STATUSES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
    bookings.forEach((b) => { stats[b.status] = (stats[b.status] || 0) + 1; });
    res.json({ bookings, stats });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/bookings/:id/status — cambia stato prenotazione
router.put('/bookings/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (BOOKING_STATUSES.indexOf(status) === -1) {
      return res.status(400).json({ error: `Stato non valido. Ammessi: ${BOOKING_STATUSES.join(', ')}` });
    }
    const id = Number(req.params.id);
    const existing = await db('bookings').where({ id }).first();
    if (!existing) return res.status(404).json({ error: 'Prenotazione non trovata' });
    await db('bookings').where({ id }).update({ status, updated_at: db.fn.now() });
    res.json({ ok: true, id, status });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/blocked-dates — elenco date bloccate
router.get('/blocked-dates', requireAdmin, async (req, res, next) => {
  try {
    const rows = await db('blocked_dates').orderBy('date', 'asc').select('id', 'date', 'reason');
    res.json({ blocked: rows.map((r) => ({ ...r, date: dateStr(r.date) })) });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/blocked-dates — blocca un giorno o un intervallo [from,to]
// body: { from: 'YYYY-MM-DD', to?: 'YYYY-MM-DD', reason?: string }
router.post('/blocked-dates', requireAdmin, async (req, res, next) => {
  try {
    const { from, reason } = req.body || {};
    const to = req.body && req.body.to ? req.body.to : from;
    const start = availability.parseDate(from);
    const end = availability.parseDate(to);
    if (!start || !end) {
      return res.status(400).json({ error: 'Date non valide (formato YYYY-MM-DD).' });
    }
    if (end < start) {
      return res.status(400).json({ error: 'La data finale deve essere uguale o successiva a quella iniziale.' });
    }
    const room = await defaultRoom();
    if (!room) return res.status(404).json({ error: 'Appartamento non trovato' });

    // Intervallo inclusivo (blocca singoli giorni, check_out non si applica qui).
    const rows = [];
    for (let d = start; d <= end; d = availability.addDays(d, 1)) {
      rows.push({ room_id: room.id, date: availability.toISO(d), reason: reason || null });
    }
    await db('blocked_dates').insert(rows).onConflict(['room_id', 'date']).ignore();
    res.status(201).json({ ok: true, count: rows.length });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/blocked-dates/:id — sblocca una data
router.delete('/blocked-dates/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const n = await db('blocked_dates').where({ id }).del();
    if (!n) return res.status(404).json({ error: 'Data bloccata non trovata' });
    res.json({ ok: true, id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
