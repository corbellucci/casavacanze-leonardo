# Casa Vacanze Leonardo

Sito web del B&B **Casa Vacanze Leonardo** (Marsala, TP): vetrina, prenotazioni
online con calcolo prezzo stagionale e pagamento acconto via PayPal, pannello
admin per la gestione delle prenotazioni. Multilingua (IT / EN / DE / FR).

## Stack

- Node.js + Express
- Knex.js (SQLite in sviluppo, PostgreSQL in produzione su Render)
- HTML + Tailwind CSS (CDN) + Vanilla JS
- PayPal SDK · Nodemailer (Gmail SMTP) · express-session + bcrypt

## Avvio in locale

```bash
npm install
cp .env.example .env      # poi compila i valori
npm run db:reset          # migrations + seed (quando disponibili)
npm run dev               # avvia con nodemon su http://localhost:3000
```

## Script utili

| Script | Descrizione |
|--------|-------------|
| `npm start` | Avvia il server (produzione) |
| `npm run dev` | Avvia con nodemon (sviluppo) |
| `npm run migrate` | Esegue le migrations |
| `npm run seed` | Esegue i seed |
| `npm run db:reset` | Rollback completo + migrate + seed |

## Stato del progetto

Vedi `SESSION-LOG.md` per lo stato di avanzamento dettagliato e i dati del B&B.

## Note

- Le variabili sensibili stanno in `.env` (mai committato). Vedi `.env.example`.
- In produzione le variabili vanno configurate nel pannello Render.
