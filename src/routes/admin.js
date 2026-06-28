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
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

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

// --- Rotte protette (placeholder, Fase 7) ---
router.get('/bookings', requireAdmin, (req, res) => {
  res.status(501).json({ error: 'Lista prenotazioni admin: da implementare (Fase 7)' });
});

router.put('/bookings/:id/status', requireAdmin, (req, res) => {
  res.status(501).json({ error: 'Aggiorna stato: da implementare (Fase 7)' });
});

router.post('/blocked-dates', requireAdmin, (req, res) => {
  res.status(501).json({ error: 'Blocca date: da implementare (Fase 7)' });
});

router.delete('/blocked-dates/:id', requireAdmin, (req, res) => {
  res.status(501).json({ error: 'Sblocca date: da implementare (Fase 7)' });
});

module.exports = router;
