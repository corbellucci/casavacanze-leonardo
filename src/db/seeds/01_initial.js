/**
 * Seed iniziale: 1 appartamento, 3 stagioni tariffarie, 1 utente admin.
 *
 * I testi descrittivi sono IPOTIZZATI dall'assistente e vanno rivisti con il
 * proprietario. Le immagini usano placeholder picsum.photos fino a quando non
 * saranno disponibili le foto reali (verranno messe in /public/images).
 *
 * Credenziali admin: lette da ADMIN_USERNAME / ADMIN_PASSWORD nel .env
 * (con fallback per lo sviluppo).
 */
const bcrypt = require('bcrypt');

const DESCRIPTIONS = {
  it:
    'Casa Vacanze Leonardo è un accogliente appartamento immerso nella campagna ' +
    'di Marsala, in contrada Leonardo. Dispone di due camere da letto, cucina ' +
    'abitabile e bagno, ideale per famiglie o piccoli gruppi fino a 4 ospiti. ' +
    'All\u2019esterno vi attendono un curato giardino con veranda, perfetta per le ' +
    'cene estive, e una comoda doccia esterna. Luce, gas e acqua sono inclusi, ' +
    'così come il parcheggio privato. Il luogo ideale per scoprire le saline, le ' +
    'spiagge e i vini del territorio marsalese in totale relax.',
  en:
    'Casa Vacanze Leonardo is a cosy apartment set in the countryside of Marsala, ' +
    'in the Leonardo district. It features two bedrooms, an eat-in kitchen and a ' +
    'bathroom, ideal for families or small groups of up to 4 guests. Outside you ' +
    'will find a well-kept garden with a veranda, perfect for summer dinners, and ' +
    'a convenient outdoor shower. Electricity, gas and water are included, as well ' +
    'as private parking. The perfect base to explore the salt pans, beaches and ' +
    'wines of the Marsala area in complete relaxation.',
  de:
    'Casa Vacanze Leonardo ist eine gemütliche Wohnung im Landesinneren von ' +
    'Marsala, im Bezirk Leonardo. Sie verfügt über zwei Schlafzimmer, eine ' +
    'Wohnküche und ein Bad und ist ideal für Familien oder kleine Gruppen von bis ' +
    'zu 4 Gästen. Draußen erwarten Sie ein gepflegter Garten mit Veranda, perfekt ' +
    'für sommerliche Abendessen, sowie eine praktische Außendusche. Strom, Gas und ' +
    'Wasser sind inbegriffen, ebenso wie ein privater Parkplatz. Der ideale ' +
    'Ausgangspunkt, um die Salinen, Strände und Weine der Region Marsala in aller ' +
    'Ruhe zu entdecken.',
  fr:
    'Casa Vacanze Leonardo est un appartement chaleureux niché dans la campagne de ' +
    'Marsala, dans le quartier de Leonardo. Il dispose de deux chambres, d\u2019une ' +
    'cuisine équipée et d\u2019une salle de bain, idéal pour les familles ou les petits ' +
    'groupes jusqu\u2019à 4 personnes. À l\u2019extérieur vous attendent un jardin soigné ' +
    'avec véranda, parfait pour les dîners d\u2019été, et une douche extérieure bien ' +
    'pratique. L\u2019électricité, le gaz et l\u2019eau sont inclus, tout comme le parking ' +
    'privé. Le point de départ idéal pour découvrir les salines, les plages et les ' +
    'vins de la région de Marsala en toute tranquillité.',
};

const AMENITIES = [
  'parking',
  'kitchen',
  'utilities_included',
  'two_bedrooms',
  'garden',
  'veranda',
  'outdoor_shower',
];

// Foto reali del proprietario (in /public/images).
const IMAGES = [
  '/images/hero.jpg',
  '/images/esterno-1.jpg',
  '/images/esterno-2.jpg',
  '/images/veranda-1.jpg',
  '/images/veranda-2.jpg',
  '/images/giardino-1.jpg',
  '/images/giardino-2.jpg',
  '/images/doccia-esterna.jpg',
  '/images/soggiorno-1.jpg',
  '/images/soggiorno-2.jpg',
  '/images/soggiorno-3.jpg',
  '/images/cucina-1.jpg',
  '/images/cucina-2.jpg',
  '/images/camera-1.jpg',
  '/images/camera-2.jpg',
  '/images/dintorni-1.jpg',
  '/images/dintorni-2.jpg',
];

exports.seed = async function (knex) {
  // Pulizia in ordine inverso rispetto alle dipendenze FK.
  await knex('blocked_dates').del();
  await knex('bookings').del();
  await knex('seasons').del();
  await knex('admin_users').del();
  await knex('rooms').del();

  // --- Appartamento ---
  const [room] = await knex('rooms')
    .insert({
      slug: 'casa-vacanze-leonardo',
      name: 'Casa Vacanze Leonardo',
      description_it: DESCRIPTIONS.it,
      description_en: DESCRIPTIONS.en,
      description_de: DESCRIPTIONS.de,
      description_fr: DESCRIPTIONS.fr,
      capacity: 4,
      min_nights: 2,
      default_price: 80,
      cleaning_fee: 20,
      security_deposit: 100,
      deposit_percent: 40,
      amenities: JSON.stringify(AMENITIES),
      images: JSON.stringify(IMAGES),
      is_active: true,
    })
    .returning('id');

  const roomId = typeof room === 'object' ? room.id : room;

  // --- Stagioni tariffarie ---
  await knex('seasons').insert([
    {
      room_id: roomId,
      name: 'bassa',
      price_per_night: 60,
      months: JSON.stringify([11, 12, 1, 2, 3]),
      is_active: true,
    },
    {
      room_id: roomId,
      name: 'media',
      price_per_night: 80,
      months: JSON.stringify([4, 5, 6, 9, 10]),
      is_active: true,
    },
    {
      room_id: roomId,
      name: 'alta',
      price_per_night: 110,
      months: JSON.stringify([7, 8]),
      is_active: true,
    },
  ]);

  // --- Utente admin ---
  const username = process.env.ADMIN_USERNAME || 'admin';
  const plainPassword = process.env.ADMIN_PASSWORD || 'CasaLeonardo2026!';
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  await knex('admin_users').insert({
    username,
    password_hash: passwordHash,
  });

  // eslint-disable-next-line no-console
  console.log(
    `Seed completato: appartamento #${roomId}, 3 stagioni, admin "${username}".`
  );
};
