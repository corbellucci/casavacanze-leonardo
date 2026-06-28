/**
 * Entry point dell'applicazione Express per Casa Vacanze Leonardo.
 *
 * Responsabilità:
 *  - caricare le variabili ambiente (.env)
 *  - servire i file statici da /public
 *  - configurare le sessioni admin
 *  - montare le rotte API e quelle pubbliche
 *  - gestione centralizzata degli errori e health-check
 */
require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');

const initDb = require('./db/initDb');
const indexRoutes = require('./routes/index');
const bookingRoutes = require('./routes/booking');
const paymentRoutes = require('./routes/payment');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Dietro il proxy di Render serve trust proxy per i cookie "secure".
if (isProduction) {
  app.set('trust proxy', 1);
}

// --- Body parser ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Sessioni admin ---
app.use(
  session({
    name: 'cvl.sid',
    secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8, // 8 ore
    },
  })
);

// --- Health-check (utile per Render) ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), env: process.env.NODE_ENV || 'development' });
});

// --- API ---
app.use('/api', indexRoutes); // /api/rooms, ...
app.use('/api/bookings', bookingRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);

// --- File statici (frontend) ---
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Fallback per le pagine non-API non trovate ---
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint non trovato' });
  }
  return next();
});

// --- Gestione errori centralizzata ---
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error('[ERRORE]', err);
  const status = err.status || 500;
  if (req.path.startsWith('/api/')) {
    return res.status(status).json({ error: err.message || 'Errore interno del server' });
  }
  return res.status(status).send(err.message || 'Errore interno del server');
});

// Inizializza il DB (migrations + seed-se-vuoto) e poi avvia il server.
initDb()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Casa Vacanze Leonardo in ascolto su http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[initDb] Inizializzazione database fallita:', err);
    process.exit(1);
  });

module.exports = app;
