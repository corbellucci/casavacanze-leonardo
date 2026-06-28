/**
 * Tabella `seasons` (stagioni tariffarie).
 * Ogni stagione definisce un prezzo/notte e i mesi a cui si applica.
 * `months` è un array JSON di interi 1-12 (es. alta stagione = [7,8]).
 *
 * Il prezzo di una notte si calcola cercando la stagione il cui array
 * `months` contiene il mese della notte. Se nessuna stagione copre il mese,
 * si usa `rooms.default_price`.
 *
 * `room_id` può essere NULL per stagioni valide globalmente (qui legate
 * comunque all'unico appartamento).
 */
exports.up = async function (knex) {
  await knex.schema.createTable('seasons', (t) => {
    t.increments('id').primary();
    t.integer('room_id').unsigned().references('id').inTable('rooms').onDelete('CASCADE');
    t.string('name').notNullable(); // chiave: 'bassa' | 'media' | 'alta'
    t.decimal('price_per_night', 10, 2).notNullable();
    t.text('months').notNullable(); // array JSON di interi 1-12
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('seasons');
};
