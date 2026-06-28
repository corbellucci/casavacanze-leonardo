/**
 * Tabella `rooms` (appartamenti).
 * Struttura generica per supportare future espansioni, anche se per ora
 * il B&B ha un solo appartamento.
 *
 * I testi traducibili (descrizione) sono salvati per lingua: it/en/de/fr.
 * `amenities` e `images` sono array JSON (le label dei servizi vengono
 * tradotte lato applicazione tramite chiavi i18n).
 */
exports.up = async function (knex) {
  await knex.schema.createTable('rooms', (t) => {
    t.increments('id').primary();
    t.string('slug').notNullable().unique();
    t.string('name').notNullable();

    // Descrizioni multilingua
    t.text('description_it');
    t.text('description_en');
    t.text('description_de');
    t.text('description_fr');

    t.integer('capacity').notNullable().defaultTo(2);
    t.integer('min_nights').notNullable().defaultTo(2);

    // Prezzo di fallback (se nessuna stagione copre la data)
    t.decimal('default_price', 10, 2).notNullable().defaultTo(0);

    // Costi accessori
    t.decimal('cleaning_fee', 10, 2).notNullable().defaultTo(0); // pulizie una tantum
    t.decimal('security_deposit', 10, 2).notNullable().defaultTo(0); // cauzione (in loco)

    // Percentuale acconto richiesta online (es. 40 = 40%)
    t.integer('deposit_percent').notNullable().defaultTo(40);

    // Array JSON: chiavi amenities e percorsi immagini
    t.text('amenities'); // es. ["parking","kitchen","utilities_included"]
    t.text('images'); // es. ["/images/hero.jpg", ...]

    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('rooms');
};
