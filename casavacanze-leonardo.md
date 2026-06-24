# Progetto: Sito B&B Casa Vacanze Leonardo

## Contesto

Stai sviluppando il sito web per un B&B chiamato **Casa Vacanze Leonardo** (`casavacanzeleonardo.it`).
Il sito deve essere una vetrina professionale con sistema di prenotazione e pagamento PayPal.
Verrà deployato su **Render.com** (Node.js Web Service) con dominio personalizzato su Aruba.

---

## Stack tecnologico

- **Backend:** Node.js + Express
- **Database:** SQLite (locale) → PostgreSQL (produzione su Render)
- **Frontend:** HTML5 + Tailwind CSS (CDN) + Vanilla JS
- **Pagamenti:** PayPal SDK (REST API)
- **Email:** Nodemailer + Gmail SMTP
- **Sessioni admin:** express-session + bcrypt
- **ORM:** Knex.js (query builder, supporta sia SQLite che PostgreSQL)

---

## Struttura del progetto da creare

```
casavacanze-leonardo/
├── casavacanze-leonardo.md                  # Questo file
├── package.json
├── .env.example               # Template variabili ambiente (mai committare .env)
├── .gitignore
├── render.yaml                # Configurazione deploy Render
├── README.md
│
├── src/
│   ├── server.js              # Entry point Express
│   ├── config/
│   │   ├── database.js        # Configurazione Knex (SQLite/PostgreSQL)
│   │   └── paypal.js          # Configurazione PayPal SDK
│   │
│   ├── routes/
│   │   ├── index.js           # Rotte pubbliche (homepage, camere, contatti)
│   │   ├── booking.js         # Rotte prenotazione e disponibilità
│   │   ├── payment.js         # Rotte PayPal (create order, capture, webhook)
│   │   └── admin.js           # Rotte pannello admin (protette)
│   │
│   ├── middleware/
│   │   └── auth.js            # Middleware autenticazione admin
│   │
│   ├── db/
│   │   ├── migrations/        # Knex migrations
│   │   └── seeds/             # Dati di esempio
│   │
│   └── utils/
│       └── email.js           # Helper invio email
│
└── public/
    ├── index.html             # Homepage
    ├── camere.html            # Pagina camere
    ├── prenota.html           # Form prenotazione
    ├── conferma.html          # Pagina conferma prenotazione
    ├── contatti.html          # Pagina contatti
    ├── admin/
    │   ├── login.html         # Login admin
    │   └── dashboard.html     # Dashboard admin
    ├── css/
    │   └── custom.css         # Stili custom (Tailwind via CDN)
    ├── js/
    │   ├── booking.js         # Logica calendario e form prenotazione
    │   ├── paypal.js          # Integrazione PayPal Buttons SDK
    │   └── admin.js           # Logica dashboard admin
    └── images/                # Placeholder per foto B&B
```

---

## Schema database

### Tabella `rooms` (camere)

```sql
id, name, description, capacity, price_per_night, images (JSON), amenities (JSON), is_active
```

### Tabella `bookings` (prenotazioni)

```sql
id, room_id, guest_name, guest_email, guest_phone,
check_in, check_out, num_guests, total_price,
status (pending/confirmed/cancelled/completed),
paypal_order_id, paypal_capture_id,
notes, created_at, updated_at
```

### Tabella `admin_users`

```sql
id, username, password_hash, created_at
```

### Tabella `blocked_dates` (date non disponibili)

```sql
id, room_id, date, reason
```

---

NOTA: Il B&B ha attualmente UN SOLO appartamento. 
La tabella rooms va popolata con una sola entry nel seed. 
La pagina "camere" diventa la pagina dell'appartamento (dettaglio singolo, 
non lista), ma la struttura DB rimane generica per supportare future espansioni.



## Funzionalità da implementare

### Sito pubblico

1. **Homepage** — Hero con foto, descrizione B&B, highlights, mappa Google
2. **Pagina Camere** — Card per ogni camera con foto, descrizione, prezzo, pulsante prenota
3. **Form Prenotazione**
   - Selezione camera (o pre-selezionata dalla pagina camere)
   - Date check-in / check-out con calendario
   - Numero ospiti
   - Dati ospite (nome, email, telefono, note)
   - Calcolo automatico prezzo totale
   - Verifica disponibilità in tempo reale (API GET /api/availability)
4. **Pagamento PayPal**
   - Pulsante PayPal Smart Button
   - Flusso: crea ordine → pagamento → cattura → conferma
   - Gestione errori e cancellazione
5. **Pagina Conferma** — Riepilogo prenotazione + email automatica all'ospite e al proprietario
6. **Pagina Contatti** — Indirizzo, telefono, email, mappa

### Pannello Admin (protetto da login)

1. **Login** — Form con username/password
2. **Dashboard** con:
   - Calendario mensile con prenotazioni visualizzate per colore
   - Lista prenotazioni (filtrabile per stato, data, camera)
   - Dettaglio prenotazione con possibilità di cambiare stato
   - Gestione disponibilità (blocca/sblocca date)
   - Sezione camere (modifica prezzi, descrizioni — fase 2)

---

## API REST da esporre

```
GET  /api/rooms                          # Lista camere attive
GET  /api/availability?room_id=&from=&to= # Verifica disponibilità
POST /api/bookings                       # Crea prenotazione (pending)
GET  /api/bookings/:id                   # Dettaglio prenotazione

POST /api/payment/create-order           # Crea ordine PayPal
POST /api/payment/capture/:orderId       # Cattura pagamento PayPal

POST /api/admin/login                    # Login admin
GET  /api/admin/bookings                 # Lista prenotazioni (protetto)
PUT  /api/admin/bookings/:id/status      # Aggiorna stato (protetto)
POST /api/admin/blocked-dates            # Blocca date (protetto)
DELETE /api/admin/blocked-dates/:id      # Sblocca date (protetto)
```

---

## Variabili ambiente (.env)

```env
# Server
PORT=3000
NODE_ENV=development
SESSION_SECRET=cambia_questo_valore_segreto

# Database
DATABASE_URL=./db/local.sqlite   # In prod: stringa PostgreSQL di Render

# PayPal (Sandbox per sviluppo, Live per produzione)
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
PAYPAL_MODE=sandbox   # oppure: live

# Email (Gmail SMTP)
EMAIL_USER=tuaemail@gmail.com
EMAIL_PASS=app_password_gmail   # App Password, non la password normale
EMAIL_TO=proprietario@gmail.com # Email del proprietario B&B

# URL pubblico (per webhook PayPal)
BASE_URL=http://localhost:3000
```

---

## Design e UI

- **Stile:** Caldo, accogliente, mediterraneo — colori terra (beige, terracotta, verde oliva)
- **Font:** Google Fonts — `Playfair Display` per titoli, `Lato` per testo
- **Tailwind CSS** via CDN (nessun build step necessario)
- Il sito deve essere **mobile-first** e completamente responsive
- Foto placeholder con servizi come `picsum.photos` fino a quando il proprietario non fornisce le foto reali

---

## Note per il deploy su Render

- Creare `render.yaml` con configurazione Web Service Node.js
- Il database in produzione sarà **PostgreSQL** (servizio gratuito Render)
- Knex deve rilevare automaticamente l'ambiente: SQLite in locale, PostgreSQL in produzione
- Le variabili ambiente vanno configurate nel pannello Render (non nel codice)
- Il file `Procfile` o lo script start in `package.json` deve essere: `node src/server.js`

---

## Ordine di sviluppo suggerito

1. Setup progetto (package.json, dipendenze, struttura cartelle)
2. Configurazione database e migrations
3. Server Express base con rotte statiche
4. Homepage e pagina camere (solo frontend)
5. API disponibilità e form prenotazione
6. Integrazione PayPal (sandbox)
7. Email di conferma
8. Pannello admin
9. Seed dati di esempio
10. Test end-to-end flusso prenotazione
11. Configurazione render.yaml per deploy

---

## Comando per iniziare

```bash
mkdir casavacanze-leonardo && cd casavacanze-leonardo
npm init -y
npm install express knex better-sqlite3 pg bcrypt express-session nodemailer dotenv
npm install --save-dev nodemon
```

Poi procedi nell'ordine suggerito sopra, un passo alla volta.
