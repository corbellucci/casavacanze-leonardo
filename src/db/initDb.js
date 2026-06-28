/**
 * Inizializzazione del database all'avvio dell'applicazione.
 *
 * Rende il deploy "self-contained" (utile su Render free, dove non c'è shell):
 *  1. Applica le migrations mancanti (idempotente).
 *  2. Esegue il seed iniziale SOLO se il database è vuoto.
 *
 * ⚠️ Il seed (src/db/seeds/01_initial.js) fa del() su tutte le tabelle, quindi
 * NON va mai rieseguito su un DB già popolato: cancellerebbe le prenotazioni.
 * Per questo qui il seed parte solo quando la tabella `rooms` è vuota.
 */
const db = require('../config/database');

async function initDb() {
  // 1) Migrations (sicure da rieseguire: applicano solo ciò che manca).
  await db.migrate.latest();

  // 2) Seed solo a DB vuoto.
  const hasRoom = await db('rooms').first('id').catch(() => null);
  if (!hasRoom) {
    await db.seed.run();
    // eslint-disable-next-line no-console
    console.log('[initDb] Database vuoto: seed iniziale eseguito.');
  } else {
    // eslint-disable-next-line no-console
    console.log('[initDb] Database già popolato: seed saltato.');
  }
}

module.exports = initDb;
