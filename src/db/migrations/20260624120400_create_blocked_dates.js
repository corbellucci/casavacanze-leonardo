/**
 * Tabella `blocked_dates` (date non disponibili).
 * Usata dall'admin per bloccare manualmente giorni (manutenzione, uso
 * personale, prenotazioni esterne tipo Airbnb/Booking, ecc.).
 */
exports.up = async function (knex) {
  await knex.schema.createTable('blocked_dates', (t) => {
    t.increments('id').primary();
    t.integer('room_id').unsigned().notNullable().references('id').inTable('rooms').onDelete('CASCADE');
    t.date('date').notNullable();
    t.string('reason');
    t.timestamps(true, true);

    t.unique(['room_id', 'date']);
    t.index('date');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('blocked_dates');
};
