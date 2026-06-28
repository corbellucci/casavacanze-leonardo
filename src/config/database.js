/**
 * Istanza condivisa di Knex per tutta l'applicazione.
 * Usa la configurazione "attiva" definita in knexfile.js, così la stessa
 * logica di rilevamento ambiente (SQLite vs PostgreSQL) vale ovunque.
 */
const knexConfig = require('../../knexfile');
const knex = require('knex');

const db = knex(knexConfig.active);

module.exports = db;
