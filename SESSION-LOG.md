# Session Log — Casa Vacanze Leonardo

> File di tracciamento del lavoro. Aggiornare alla fine di ogni sessione:
> cosa è stato fatto, cosa manca, dove ripartire. Riferimento progetto: `casavacanze-leonardo.md`.

---

## Stato generale

| Fase | Descrizione | Stato |
|------|-------------|-------|
| 0 | Setup progetto (package.json, deps, struttura, .env.example, .gitignore) | ✅ Fatto |
| 1 | Database: migrations + seed (1 appartamento, 1 admin, stagioni) | ✅ Fatto |
| 2 | Server Express base (static, sessioni, rotte) | ✅ Fatto |
| 3 | Frontend pubblico (home, appartamento, contatti) — foto reali | ✅ Fatto |
| 4 | Prenotazione (API rooms/availability/bookings + calendario) | ✅ Fatto |
| 5 | PayPal sandbox (create-order, capture, conferma) | ✅ Fatto (codice pronto, mancano credenziali) |
| 6 | Email conferma (Nodemailer) | ⬜ Da fare |
| 7 | Pannello admin (login, dashboard, calendario, blocco date) | ⬜ Da fare |
| 8 | Deploy Render (render.yaml, PostgreSQL) | 🟡 In corso (repo pronto, manca push + setup Render) |

Legenda: ⬜ Da fare · 🟡 In corso · ✅ Fatto

---

## Prossimo passo
**Fase 6 — Email di conferma (Nodemailer):** inviare email all'ospite e al proprietario quando una prenotazione viene confermata (capture PayPal OK) e/o creata (pending). Richiede App Password Gmail (vedi Domande aperte #3). Configurare SMTP da `EMAIL_USER`/`EMAIL_PASS`/`EMAIL_TO`. Template multilingua (IT/EN/DE/FR) usando `bookings.lang`.

**Per attivare la Fase 5 (PayPal):** inserire in `.env` `PAYPAL_CLIENT_ID` e `PAYPAL_CLIENT_SECRET` sandbox reali (ora placeholder). Senza credenziali il sito funziona comunque: la prenotazione resta in stato `pending` (richiesta), senza pagamento online (degradazione automatica via `/api/payment/config`).

Nota ambiente: Node è disponibile come eseguibile Windows (v24). In WSL eseguire npm/node via `cmd.exe /c "..."`. better-sqlite3 è compilato per Windows.

### ⚠️ IMPORTANTE — perché la sessione sembra "bloccarsi" (stato "worker")
La Fase 2 NON si interrompe né crasha: il server parte correttamente (`_srv.log` mostra `Casa Vacanze Leonardo in ascolto su http://localhost:3000`).

Il problema è solo COME si avvia il server dentro l'agente:
- `npm run dev` usa **nodemon** e `npm start` usa **node**: sono processi che restano in **foreground per sempre** (devono tenere il server in ascolto).
- Quando l'agente lancia questi comandi, la chiamata bash **resta in attesa che il comando finisca** → non finisce mai → la UI mostra stato **"worker"** ma "non fa nulla" perché è bloccata su un processo appeso.

**Come avviare il server SENZA bloccare la sessione:**
```bash
# in background (ritorna subito)
npm run dev > _srv.log 2>&1 &
# oppure su Windows/WSL
cmd.exe /c "start /b npm run dev"

# verifica veloce e chiusura (per i test)
npm start > _srv.log 2>&1 &
sleep 2
curl -s http://localhost:3000/health
kill %1
```
Endpoint health-check disponibile: **GET `/health`** → `{ status: 'ok', uptime, env }`.

(Eventuale TODO: aggiungere uno script `dev:bg` in `package.json` per standardizzare l'avvio in background.)

Note schema DB realizzato:
- `rooms`: descrizioni multilingua (description_it/en/de/fr), default_price, cleaning_fee, security_deposit, deposit_percent, amenities/images come JSON (in SQLite tornano come stringa → fare JSON.parse).
- `seasons`: prezzo/notte + `months` (array JSON). bassa[11,12,1,2,3]=60, media[4,5,6,9,10]=80, alta[7,8]=110.
- `bookings`: lodging_total, cleaning_fee, total_price, deposit_amount(40% notti), balance_due, security_deposit, lang, status.
- Admin di default: username `admin`, password `CasaLeonardo2026!` (da .env, cambiare in prod).

---

## Domande aperte — residue

1. **Telefono** pubblico da mostrare nei contatti (manca; abbiamo solo email).
2. **Logo:** quando disponibile, mettere in `public/images/logo.png` (l'assistente avviserà in Fase 3).
3. **App Password Gmail** del proprietario: da generare (2FA + App Password) prima della Fase 6 (email).
4. **Credenziali PayPal sandbox** (client id/secret): da generare prima della Fase 5.

---

## Dati confermati dal proprietario (Sessione 2)

- **Nome:** Casa Vacanze Leonardo
- **Indirizzo:** Via del Glicine 10, Contrada Leonardo, Marsala (TP)
- **Tipo:** 1 appartamento intero
- **Capienza:** 4 ospiti
- **Composizione:** 2 camere, cucina, bagno, giardino con veranda e doccia esterna
- **Prezzi stagionali (di partenza):**
  - Bassa (nov–mar): **60 €/notte**
  - Media (apr–giu, set–ott): **80 €/notte**
  - Alta (lug–ago): **110 €/notte**
- **Notti minime:** 2
- **Pulizie:** 20 € una tantum (pagate all'arrivo con il saldo)
- **Cauzione:** 100 € — pagata IN LOCO alla consegna chiavi, rimborsabile (NON online)
- **Check-in/out:** orari liberi
- **Servizi:** parcheggio; cucina; luce, gas e acqua incluse
- **Pagamento online:** ACCONTO **40% sul solo costo delle notti** (pulizie escluse). Saldo (60% notti + 20€ pulizie) all'arrivo. Cauzione 100€ all'arrivo.
- **Lingue:** Italiano, Inglese, Tedesco, Francese (traduzioni ipotizzate dall'assistente, poi revisione madrelingua)
- **PayPal:** nessun account Business per ora → sviluppo in **sandbox**
- **Email pubblica (contatti):** info@casavacanzeleonardo.it
- **Email proprietario (invio automatico):** usare quella del proprietario (App Password / SMTP da configurare)
- **Telefono pubblico:** DA FORNIRE
- **Dominio:** già acquistato su Aruba
- **Render:** account già creato (eventualmente da cambiare in futuro)
- **Logo:** esiste (da fornire); palette mediterranea OK
- **Testi:** ipotizzati dall'assistente, da rivedere col proprietario

### Impatti sul progetto (rispetto al .md originale)
- **i18n a 4 lingue** → aggiungere selettore lingua + dizionari di traduzione (strutturare da subito).
- **Prezzi stagionali** → tabella `seasons` (range date + prezzo/notte). Calcolo: per ogni notte si applica il prezzo della stagione corrispondente.
- **Acconto 40%** → PayPal addebita solo il 40% del costo notti. Pulizie (20€) e saldo 60% e cauzione (100€) si pagano all'arrivo. Mostrare riepilogo chiaro.
- **Campi extra booking** → costo_notti, pulizie, totale_soggiorno, acconto_pagato (40% notti), saldo_residuo, cauzione.

---

## Foto
- Strategia: placeholder `picsum.photos` fino alla Fase 3.
- **Quando aggiungerle:** all'inizio della Fase 3 (l'assistente avviserà).
- **Dove:** `public/images/` con nomi tipo `hero.jpg`, `camera-1.jpg`, `bagno.jpg`, `cucina.jpg`, `esterno.jpg`.

---

## Diario sessioni

### Sessione 1 — 2026-06-24
- Letto e analizzato `casavacanze-leonardo.md`.
- Definito il piano a fasi (0–8).
- Creato questo `SESSION-LOG.md`.
- Poste le domande al proprietario; in attesa di risposte.
- Nessun codice scritto (su richiesta dell'utente).
- **Ripartire da:** raccolta risposte → Fase 0.

### Sessione 2 — 2026-06-24
- Ricevute risposte al Round 1: aggiornata sezione "Dati confermati".
- Identificati impatti: i18n 4 lingue, prezzi stagionali, acconto 40%.
- Poste domande Round 2 (prezzi stagionali, cauzione, base acconto, email, contatti).
- Ancora nessun codice scritto.
- **Ripartire da:** risposte Round 2 → Fase 0 (Setup).

### Sessione 3 — 2026-06-24
- Ricevute tutte le risposte: prezzi stagionali, cauzione in loco, acconto 40% sulle notti, email pubblica info@, traduzioni a carico assistente.
- Aggiornata sezione "Dati confermati" con valori definitivi.
- Restano da fornire: telefono pubblico, logo, App Password Gmail, credenziali PayPal sandbox (non bloccanti per Fase 0–4).
- **PRONTI PER INIZIARE LA FASE 0 (Setup).** In attesa di OK dall'utente.
- **Ripartire da:** Fase 0 — `npm init`, dipendenze, struttura cartelle, config Knex.

### Sessione 4 — 2026-06-24 — FASE 0 COMPLETATA ✅
- Creati: `package.json`, `.gitignore`, `.env.example`, `README.md`.
- Config DB: `knexfile.js` (rilevamento auto SQLite/PostgreSQL) + `src/config/database.js`.
- Creata struttura cartelle: `src/{config,routes,middleware,db/migrations,db/seeds,utils,i18n}`, `public/{css,js,images,admin}`.
- `npm install` eseguito (223 pacchetti). better-sqlite3 compilato per Windows.
- Smoke test superato: Knex carica con client `better-sqlite3`.
- **Ripartire da:** Fase 1 — migrations e seed (vedi "Prossimo passo").

### Sessione 5 — 2026-06-24 — FASE 1 COMPLETATA ✅
- Create 5 migrations: rooms, seasons, bookings, admin_users, blocked_dates.
- Aggiunte rispetto al .md: tabella `seasons` (prezzi stagionali) e campi economici dettagliati in `bookings`.
- Creato seed `01_initial.js`: 1 appartamento (testi IT/EN/DE/FR ipotizzati), 3 stagioni, 1 admin (bcrypt).
- Immagini: placeholder picsum.photos (da sostituire in Fase 3).
- Aggiunte ADMIN_USERNAME/ADMIN_PASSWORD a `.env.example`.
- `npx knex migrate:latest` + `seed:run` eseguiti con successo; dati verificati con query.
- **Ripartire da:** Fase 2 — Server Express base.

### Sessione 6 — 2026-06-25 — FASE 2 COMPLETATA ✅
- Creato `src/server.js`: dotenv, body parser (json/urlencoded), express-session (cookie `cvl.sid`, secure in prod, trust proxy su Render), static da `/public`, gestione errori centralizzata, fallback 404 API.
- Health-check attivo: **GET `/health`**.
- Montate le rotte: `/api` (index), `/api/bookings`, `/api/payment`, `/api/admin`. Endpoint non ancora implementati rispondono `501` con riferimento alla fase (Fase 4/5/7).
- **Server verificato funzionante:** `_srv.log` → `in ascolto su http://localhost:3000`.
- **Chiarito il falso problema "worker"/sessione bloccata:** è solo `npm run dev`/`npm start` che resta in foreground; usare l'avvio in background (vedi "Prossimo passo" → riquadro IMPORTANTE).
- **Ripartire da:** Fase 3 — Frontend pubblico (home/appartamento/contatti) + foto reali + i18n 4 lingue. Avviare il server in background prima di testare.

### Sessione 7 — 2026-06-28 — FASI 3, 4, 5 COMPLETATE ✅
- **Fase 3/4 — Frontend + Prenotazione:**
  - Aggiunta enfasi **kitesurf**: badge hero + callout in "Dove siamo" (a 5 min a piedi dalle scuole dello Stagnone), tradotto IT/EN/DE/FR.
  - Nuova pagina **`/prenota.html`** con calendario disponibilità (date passate/occupate disabilitate), selezione arrivo→partenza, riepilogo prezzi live e form ospite.
  - Backend: nuovo `src/services/availability.js` (pricing stagionale + disponibilità). Implementati `GET /api/availability` (date occupate + preventivo), `POST /api/bookings` (crea pending, calcolo prezzi, **anti doppia-prenotazione 409**), `GET /api/bookings/:id`.
  - Test E2E OK: preventivo 4 notti alta=460€ (acconto 176€), creazione 201, conflitto 409, date occupate segnate. DB ripulito dai test.
- **Fase 5 — PayPal (sandbox):**
  - Nuovo `src/services/paypal.js` (REST API v2 via `fetch`, niente SDK/npm). Implementati `GET /api/payment/config`, `POST /api/payment/create-order`, `POST /api/payment/capture/:orderId` (capture → booking `confirmed` + capture_id).
  - Frontend: step pagamento con **PayPal Buttons** (SDK caricato dinamicamente) sulla pagina prenotazione, con messaggi confermato/in attesa multilingua.
  - **Degradazione automatica:** senza credenziali reali (placeholder) `config.enabled=false`, gli endpoint pagamento danno 503 e il flusso resta "pending". Verificato.
- **Nota:** lo script `server-bg.ps1 restart` va ancora in timeout su WSL (blocco noto, da sistemare), ma il processo node detached riparte correttamente. Test API fatti via `powershell Invoke-WebRequest`.
- **Ripartire da:** Fase 6 — Email conferma (Nodemailer).

### Sessione 9 — 2026-06-29 — FASE 8 avviata (deploy)
- Strategia concordata: prima online su Render, poi rifinitura pagamenti/booking, **dominio Aruba per ultimo**.
- Creato **`render.yaml`** (blueprint: web service Node free + PostgreSQL free, region frankfurt, healthCheck `/health`, segreti come `sync:false`).
- Creato **`src/db/initDb.js`** e integrato in `server.js`: all'avvio esegue `migrate.latest()` e il **seed solo se `rooms` è vuoto** (deploy self-contained, niente shell, prenotazioni mai cancellate).
- `package.json`: aggiunto `engines` Node `>=20 <23`.
- `.gitignore` ripulito (esclusi `.env`, `foto/`, `pi-session-*.html`, file `_*`).
- **Primo commit reale dei sorgenti** (`e314d23`, 54 file). ⚠️ **PUSH NON ancora fatto**: serve autenticazione GitHub interattiva (`git push origin main` dal terminale utente).
- Verifica locale OK: server parte con initDb, `/health` e `/api/rooms` rispondono.
- **Ripartire da:** 1) `git push origin main`; 2) creare Blueprint su Render dal repo; 3) impostare variabili segrete; 4) verificare sito online; poi Fase 6 (email)/rifinitura PayPal.

### Sessione 8 — 2026-06-29 — FIX avvio background
- **Risolto il blocco/timeout di `server-bg.ps1`** (incl. `restart`): rimossa la redirezione `-RedirectStandardOutput/-RedirectStandardError` di `Start-Process` (teneva vivo il padre → timeout chiamando `powershell.exe` da WSL).
- Ora l'avvio usa un **wrapper cmd** (`cmd /c node ... > _srv.log 2> _srv.log.err`): redirezione a livello di shell, processo node detached, PowerShell esce subito. Il PID reale di node viene recuperato come figlio del cmd; `stop` usa `taskkill /T /F`.
- Verificato OK senza timeout: `start` (PID 47604, /health → status ok), `status`, `stop`, `restart`.
- Controllato: nessun server di test residuo (porta 3000 libera); file temporanei (`_srv.log`, `_t.log`, ecc.) ripuliti. I 2 processi `node` presenti sono il CLI dell'agent, non il server.
- **Ripartire da:** Fase 6 — Email conferma (Nodemailer).
