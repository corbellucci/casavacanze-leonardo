/**
 * Tabella `admin_users` (utenti del pannello amministrativo).
 * La password è salvata come hash bcrypt.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('admin_users', (t) => {
    t.increments('id').primary();
    t.string('username').notNullable().unique();
    t.string('password_hash').notNullable();
    t.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('admin_users');
};
