/**
 * Tabella `bookings` (prenotazioni).
 *
 * Riepilogo economico:
 *  - lodging_total  = somma del prezzo notti (secondo le stagioni)
 *  - cleaning_fee   = pulizie una tantum (pagate all'arrivo)
 *  - total_price    = lodging_total + cleaning_fee (totale soggiorno)
 *  - deposit_amount = acconto pagato online = 40% di lodging_total
 *  - balance_due    = total_price - deposit_amount (saldo all'arrivo)
 *  - security_deposit = cauzione (versata in loco, rimborsabile)
 */
exports.up = async function (knex) {
  await knex.schema.createTable('bookings', (t) => {
    t.increments('id').primary();
    t.integer('room_id').unsigned().notNullable().references('id').inTable('rooms');

    // Dati ospite
    t.string('guest_name').notNullable();
    t.string('guest_email').notNullable();
    t.string('guest_phone');
    t.string('lang', 5).notNullable().defaultTo('it'); // lingua ospite per le email

    // Soggiorno
    t.date('check_in').notNullable();
    t.date('check_out').notNullable();
    t.integer('num_guests').notNullable().defaultTo(1);
    t.integer('num_nights').notNullable().defaultTo(0);

    // Economico
    t.string('currency', 3).notNullable().defaultTo('EUR');
    t.decimal('lodging_total', 10, 2).notNullable().defaultTo(0);
    t.decimal('cleaning_fee', 10, 2).notNullable().defaultTo(0);
    t.decimal('total_price', 10, 2).notNullable().defaultTo(0);
    t.decimal('deposit_amount', 10, 2).notNullable().defaultTo(0);
    t.decimal('balance_due', 10, 2).notNullable().defaultTo(0);
    t.decimal('security_deposit', 10, 2).notNullable().defaultTo(0);

    // Stato e pagamento
    t.enu('status', ['pending', 'confirmed', 'cancelled', 'completed'])
      .notNullable()
      .defaultTo('pending');
    t.string('paypal_order_id');
    t.string('paypal_capture_id');

    t.text('notes');
    t.timestamps(true, true);

    t.index(['room_id', 'check_in', 'check_out']);
    t.index('status');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('bookings');
};
