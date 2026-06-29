/**
 * Servizio di disponibilità e calcolo prezzi.
 *
 * Concetti:
 *  - una prenotazione occupa le NOTTI da check_in (incluso) a check_out (escluso);
 *    il giorno di check_out resta libero (nuovo ospite può arrivare quel giorno).
 *  - blocked_dates occupa la singola data indicata.
 *  - il prezzo di una notte dipende dal mese: si cerca la stagione i cui `months`
 *    contengono il mese; altrimenti si usa rooms.default_price.
 */
const db = require('../config/database');

function safeParse(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

/** 'YYYY-MM-DD' -> Date (UTC midnight) */
function parseDate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(str));
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** Date -> 'YYYY-MM-DD' */
function toISO(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(d, n) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/** Carica una room per id numerico o slug. */
async function getRoom(idOrSlug) {
  const query = db('rooms').where({ is_active: true });
  if (/^\d+$/.test(String(idOrSlug))) {
    query.andWhere({ id: Number(idOrSlug) });
  } else {
    query.andWhere({ slug: idOrSlug });
  }
  return query.first();
}

/** Stagioni attive di una room. */
async function getSeasons(roomId) {
  const seasons = await db('seasons')
    .where({ room_id: roomId, is_active: true })
    .select('name', 'price_per_night', 'months');
  return seasons.map((s) => ({ ...s, months: safeParse(s.months, []) }));
}

/** Prezzo di una singola notte (Date) in base alle stagioni. */
function priceForNight(date, seasons, defaultPrice) {
  const month = date.getUTCMonth() + 1;
  const season = seasons.find((s) => Array.isArray(s.months) && s.months.indexOf(month) !== -1);
  return season ? Number(season.price_per_night) : Number(defaultPrice);
}

/**
 * Insieme delle date NON disponibili in modo "definitivo" (stringhe 'YYYY-MM-DD').
 * Bloccano SOLO le prenotazioni CONFERMATE/COMPLETATE e le date bloccate da admin.
 * Le richieste 'pending' (non ancora confermate/pagate) NON bloccano: sono
 * semplici richieste e più ospiti possono inviarle sulle stesse date; sarà il
 * proprietario a confermarne una (vedi getPendingDates per l'avviso).
 */
async function getUnavailableDates(roomId, from, to) {
  const unavailable = new Set();

  const bookingsQuery = db('bookings')
    .where({ room_id: roomId })
    .whereIn('status', ['confirmed', 'completed'])
    .select('check_in', 'check_out');
  if (to) bookingsQuery.andWhere('check_in', '<', to);
  if (from) bookingsQuery.andWhere('check_out', '>', from);

  const bookings = await bookingsQuery;
  bookings.forEach((b) => {
    const start = parseDate(b.check_in);
    const end = parseDate(b.check_out); // escluso
    if (!start || !end) return;
    for (let d = start; d < end; d = addDays(d, 1)) {
      unavailable.add(toISO(d));
    }
  });

  // Date bloccate manualmente.
  const blockedQuery = db('blocked_dates').where({ room_id: roomId }).select('date');
  if (from) blockedQuery.andWhere('date', '>=', from);
  if (to) blockedQuery.andWhere('date', '<=', to);
  const blocked = await blockedQuery;
  blocked.forEach((b) => {
    const d = parseDate(b.date);
    if (d) unavailable.add(toISO(d));
  });

  return unavailable;
}

/**
 * Insieme delle date con una richiesta in attesa ('pending') non ancora confermata.
 * Usato per segnalare (non bloccare) potenziali sovrapposizioni di richieste.
 */
async function getPendingDates(roomId, from, to) {
  const pending = new Set();
  const q = db('bookings')
    .where({ room_id: roomId, status: 'pending' })
    .select('check_in', 'check_out');
  if (to) q.andWhere('check_in', '<', to);
  if (from) q.andWhere('check_out', '>', from);
  const rows = await q;
  rows.forEach((b) => {
    const start = parseDate(b.check_in);
    const end = parseDate(b.check_out);
    if (!start || !end) return;
    for (let d = start; d < end; d = addDays(d, 1)) pending.add(toISO(d));
  });
  return pending;
}

/**
 * Calcola il preventivo per un soggiorno.
 * Ritorna { nights, breakdown[], lodging_total, cleaning_fee, total_price,
 *           deposit_amount, balance_due, security_deposit }.
 * Lancia Error con .status su input non validi.
 */
function computeQuote(room, seasons, checkInStr, checkOutStr) {
  const checkIn = parseDate(checkInStr);
  const checkOut = parseDate(checkOutStr);
  if (!checkIn || !checkOut) {
    const e = new Error('Date non valide (formato YYYY-MM-DD).');
    e.status = 400;
    throw e;
  }
  if (checkOut <= checkIn) {
    const e = new Error('La data di check-out deve essere successiva al check-in.');
    e.status = 400;
    throw e;
  }

  const breakdown = [];
  let lodging = 0;
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) {
    const price = priceForNight(d, seasons, room.default_price);
    lodging += price;
    breakdown.push({ date: toISO(d), price });
  }
  const nights = breakdown.length;

  if (nights < Number(room.min_nights || 1)) {
    const e = new Error(`Soggiorno minimo: ${room.min_nights} notti.`);
    e.status = 400;
    throw e;
  }

  const cleaning = Number(room.cleaning_fee || 0);
  const total = lodging + cleaning;
  const depositPct = Number(room.deposit_percent || 0);
  const deposit = Math.round(lodging * (depositPct / 100) * 100) / 100;
  const balance = Math.round((total - deposit) * 100) / 100;

  return {
    nights,
    breakdown,
    currency: 'EUR',
    lodging_total: Math.round(lodging * 100) / 100,
    cleaning_fee: cleaning,
    total_price: Math.round(total * 100) / 100,
    deposit_percent: depositPct,
    deposit_amount: deposit,
    balance_due: balance,
    security_deposit: Number(room.security_deposit || 0),
  };
}

/** Verifica che nessuna notte del soggiorno sia occupata. */
function rangeIsFree(checkInStr, checkOutStr, unavailableSet) {
  const checkIn = parseDate(checkInStr);
  const checkOut = parseDate(checkOutStr);
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) {
    if (unavailableSet.has(toISO(d))) return false;
  }
  return true;
}

module.exports = {
  safeParse,
  parseDate,
  toISO,
  addDays,
  getRoom,
  getSeasons,
  getUnavailableDates,
  getPendingDates,
  priceForNight,
  computeQuote,
  rangeIsFree,
};
