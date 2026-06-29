/**
 * Servizio PayPal (REST API v2) — usato per incassare l'ACCONTO online.
 *
 * Non usa l'SDK ufficiale: chiama direttamente l'API REST con `fetch`
 * (disponibile nativamente su Node 18+). Funziona sia in sandbox sia in live
 * a seconda di PAYPAL_MODE.
 *
 * Variabili ambiente:
 *   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_MODE ('sandbox' | 'live')
 *
 * Se le credenziali non sono configurate (placeholder o vuote) il servizio è
 * considerato "non abilitato": il frontend ripiega sulla semplice richiesta di
 * prenotazione (stato pending), senza pagamento online.
 */
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const MODE = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();

// Valori considerati "non configurati": vuoto o qualsiasi stringa che contenga
// "placeholder"/"your_" (es. i segnaposto usati in .env.example o su Render).
function isPlaceholder(value) {
  const v = (value || '').trim().toLowerCase();
  return v === '' || v.includes('placeholder') || v.startsWith('your_');
}

function isEnabled() {
  return !isPlaceholder(CLIENT_ID) && !isPlaceholder(CLIENT_SECRET);
}

function apiBase() {
  return MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

function getClientId() {
  return CLIENT_ID;
}

function getMode() {
  return MODE;
}

/** Ottiene un access token OAuth2 (client_credentials). */
async function getAccessToken() {
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal token error (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

/**
 * Crea un ordine PayPal per l'importo indicato.
 * @param {Object} opts { amount, currency, description, reference }
 * @returns {Object} ordine PayPal (contiene .id)
 */
async function createOrder({ amount, currency = 'EUR', description, reference }) {
  const token = await getAccessToken();
  const value = Number(amount).toFixed(2);

  const res = await fetch(`${apiBase()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: reference ? String(reference) : undefined,
          description: description ? String(description).slice(0, 127) : undefined,
          amount: { currency_code: currency, value },
        },
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`PayPal create-order error (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

/**
 * Cattura (incassa) un ordine approvato.
 * @returns {Object} { status, captureId, raw }
 */
async function captureOrder(orderId) {
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`PayPal capture error (${res.status}): ${JSON.stringify(data)}`);
  }

  let captureId = null;
  try {
    captureId = data.purchase_units[0].payments.captures[0].id;
  } catch (e) {
    captureId = null;
  }

  return { status: data.status, captureId, raw: data };
}

module.exports = {
  isEnabled,
  getClientId,
  getMode,
  getAccessToken,
  createOrder,
  captureOrder,
};
