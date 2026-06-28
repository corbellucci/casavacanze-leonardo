/**
 * Configurazione Knex.
 * Rileva automaticamente l'ambiente:
 *  - sviluppo  -> SQLite (file locale)
 *  - produzione -> PostgreSQL (DATABASE_URL fornita da Render)
 *
 * La logica vera e propria di connessione vive in src/config/database.js,
 * che riusa questa stessa configurazione. Questo file serve alla CLI di Knex
 * (knex migrate / knex seed).
 */
require('dotenv').config();

const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL || './src/db/local.sqlite';

// Una stringa che inizia con "postgres" indica PostgreSQL, altrimenti SQLite.
const usePostgres = isProduction || /^postgres(ql)?:\/\//i.test(databaseUrl);

const sqliteConfig = {
  client: 'better-sqlite3',
  connection: {
    filename: path.resolve(__dirname, databaseUrl),
  },
  useNullAsDefault: true,
  migrations: {
    directory: path.resolve(__dirname, 'src/db/migrations'),
  },
  seeds: {
    directory: path.resolve(__dirname, 'src/db/seeds'),
  },
  pool: {
    afterCreate: (conn, done) => {
      // Abilita i vincoli di chiave esterna in SQLite.
      conn.pragma('foreign_keys = ON');
      done(null, conn);
    },
  },
};

const postgresConfig = {
  client: 'pg',
  connection: {
    connectionString: databaseUrl,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  },
  migrations: {
    directory: path.resolve(__dirname, 'src/db/migrations'),
  },
  seeds: {
    directory: path.resolve(__dirname, 'src/db/seeds'),
  },
  pool: { min: 0, max: 10 },
};

const active = usePostgres ? postgresConfig : sqliteConfig;

// Espone sia le chiavi development/production (per la CLI di Knex)
// sia la config "attiva" calcolata in base all'ambiente.
module.exports = {
  development: sqliteConfig,
  production: postgresConfig,
  active,
};
