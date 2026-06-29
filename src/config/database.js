/**
 * Istanza condivisa di Knex per tutta l'applicazione.
 * Usa la configurazione "attiva" definita in knexfile.js, così la stessa
 * logica di rilevamento ambiente (SQLite vs PostgreSQL) vale ovunque.
 */
const knexConfig = require('../../knexfile');
const knex = require('knex');

// Su PostgreSQL le colonne DATE vengono altrimenti convertite in oggetti Date
// (a mezzanotte locale): serializzandole in JSON il giorno può slittare per via
// del fuso. Forziamo il parser a restituirle come stringa 'YYYY-MM-DD'.
try {
  // eslint-disable-next-line global-require
  require('pg').types.setTypeParser(1082, (v) => v);
} catch (e) {
  /* pg non disponibile in ambiente solo-SQLite: ignora */
}

const db = knex(knexConfig.active);

module.exports = db;
