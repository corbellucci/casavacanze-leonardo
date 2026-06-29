/**
 * Pagina prenotazione: calendario disponibilità, selezione date,
 * preventivo (dal server) e invio prenotazione.
 */
(function () {
  'use strict';

  var ROOM_SLUG = 'casa-vacanze-leonardo';

  var MONTHS = {
    it: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    fr: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
  };
  var WEEKDAYS = {
    it: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'],
    en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    de: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
    fr: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
  };

  var state = {
    lang: window.DEFAULT_LANG,
    info: null, // risposta /api/availability
    unavailable: {}, // set come oggetto (bloccate: confermate/admin)
    pending: {}, // date con richieste in attesa (selezionabili, segnalate)
    view: new Date(), // mese mostrato
    checkIn: null, // 'YYYY-MM-DD'
    checkOut: null,
    quote: null,
    pay: { enabled: false, clientId: null, currency: 'EUR' },
    bookingId: null,
    paypalLoaded: false,
  };

  /* ---------- i18n ---------- */
  function t(key, params) {
    var dict = window.I18N[state.lang] || window.I18N[window.DEFAULT_LANG];
    var s = (dict && dict[key]) || key;
    if (params) {
      Object.keys(params).forEach(function (k) {
        s = s.replace('{' + k + '}', params[k]);
      });
    }
    return s;
  }

  function applyTranslations() {
    document.documentElement.lang = state.lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    var titleEl = document.querySelector('title[data-i18n]');
    if (titleEl) document.title = t(titleEl.getAttribute('data-i18n'));
    renderCalendar();
    renderSummary();
  }

  function setLang(lang) {
    if (window.SUPPORTED_LANGS.indexOf(lang) === -1) lang = window.DEFAULT_LANG;
    state.lang = lang;
    try { localStorage.setItem('cvl_lang', lang); } catch (e) {}
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
    applyTranslations();
  }

  function detectLang() {
    var saved;
    try { saved = localStorage.getItem('cvl_lang'); } catch (e) {}
    if (saved && window.SUPPORTED_LANGS.indexOf(saved) !== -1) return saved;
    var nav = (navigator.language || 'it').slice(0, 2).toLowerCase();
    return window.SUPPORTED_LANGS.indexOf(nav) !== -1 ? nav : window.DEFAULT_LANG;
  }

  /* ---------- date helpers ---------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromIso(s) { var p = s.split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }
  function todayIso() { return iso(new Date()); }
  function fmt(s) {
    if (!s) return '—';
    var d = fromIso(s);
    return pad(d.getDate()) + ' ' + MONTHS[state.lang][d.getMonth()] + ' ' + d.getFullYear();
  }
  function money(v) {
    return new Intl.NumberFormat(state.lang, { style: 'currency', currency: 'EUR' }).format(v);
  }

  /* ---------- dati ---------- */
  function fetchAvailability(quoteParams) {
    var url = '/api/availability?room=' + ROOM_SLUG;
    if (quoteParams) url += '&check_in=' + quoteParams.check_in + '&check_out=' + quoteParams.check_out;
    return fetch(url).then(function (r) { return r.ok ? r.json() : null; });
  }

  /* ---------- calendario ---------- */
  function isPast(dStr) { return dStr < todayIso(); }
  function isBusy(dStr) { return !!state.unavailable[dStr]; }
  function isPending(dStr) { return !!state.pending[dStr]; }

  function inSelectedRange(dStr) {
    if (!state.checkIn) return false;
    if (state.checkOut) return dStr >= state.checkIn && dStr < state.checkOut;
    return dStr === state.checkIn;
  }

  function renderCalendar() {
    var grid = document.getElementById('calGrid');
    var monthLabel = document.getElementById('calMonth');
    var wd = document.getElementById('calWeekdays');
    if (!grid) return;

    monthLabel.textContent = MONTHS[state.lang][state.view.getMonth()] + ' ' + state.view.getFullYear();

    wd.innerHTML = '';
    WEEKDAYS[state.lang].forEach(function (w) {
      var s = document.createElement('span');
      s.textContent = w;
      wd.appendChild(s);
    });

    grid.innerHTML = '';
    var year = state.view.getFullYear();
    var month = state.view.getMonth();
    var first = new Date(year, month, 1);
    // offset lun=0 ... dom=6
    var offset = (first.getDay() + 6) % 7;
    var daysInMonth = new Date(year, month + 1, 0).getDate();

    for (var i = 0; i < offset; i++) {
      var blank = document.createElement('span');
      blank.className = 'cal-cell empty';
      grid.appendChild(blank);
    }

    for (var day = 1; day <= daysInMonth; day++) {
      var dStr = year + '-' + pad(month + 1) + '-' + pad(day);
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cal-cell';
      cell.textContent = day;

      if (isPast(dStr)) {
        cell.classList.add('past');
        cell.disabled = true;
      } else if (isBusy(dStr)) {
        cell.classList.add('busy');
        cell.disabled = true;
      } else {
        cell.classList.add('free');
        if (isPending(dStr)) {
          cell.classList.add('tentative');
          cell.title = t('book.legend.pending');
        }
        (function (ds) {
          cell.addEventListener('click', function () { onPickDate(ds); });
        })(dStr);
      }

      if (inSelectedRange(dStr)) cell.classList.add('selected');
      if (dStr === state.checkIn) cell.classList.add('range-start');
      if (state.checkOut && dStr === state.checkOut) cell.classList.add('range-end');

      grid.appendChild(cell);
    }
  }

  function rangeHasBusy(fromStr, toStr) {
    var d = fromIso(fromStr);
    var end = fromIso(toStr);
    while (d < end) {
      if (isBusy(iso(d))) return true;
      d.setDate(d.getDate() + 1);
    }
    return false;
  }

  function showCalError(msg) {
    var el = document.getElementById('calError');
    if (msg) { el.textContent = msg; el.hidden = false; }
    else { el.hidden = true; }
  }

  function onPickDate(dStr) {
    showCalError('');
    // Nessun check-in, oppure già completo, oppure click prima del check-in -> nuovo check-in
    if (!state.checkIn || state.checkOut || dStr <= state.checkIn) {
      state.checkIn = dStr;
      state.checkOut = null;
      state.quote = null;
      renderCalendar();
      renderSummary();
      return;
    }
    // dStr > checkIn -> tentativo di check-out
    if (rangeHasBusy(state.checkIn, dStr)) {
      showCalError(t('book.rangeBusy'));
      // riparti dal nuovo giorno come check-in
      state.checkIn = dStr;
      state.checkOut = null;
      state.quote = null;
      renderCalendar();
      renderSummary();
      return;
    }
    state.checkOut = dStr;
    renderCalendar();
    loadQuote();
  }

  function loadQuote() {
    if (!state.checkIn || !state.checkOut) return;
    fetchAvailability({ check_in: state.checkIn, check_out: state.checkOut }).then(function (data) {
      if (data && data.quote && !data.quote.error) {
        state.quote = data.quote;
        showCalError('');
      } else {
        state.quote = null;
        var msg = data && data.quote && data.quote.error ? data.quote.error : t('book.error');
        // min nights message localizzato
        if (data && data.quote && /minimo|minimum|Mindest|minimum/i.test(msg)) {
          msg = t('book.minNights', { n: state.info ? state.info.min_nights : 2 });
        }
        showCalError(msg);
      }
      renderSummary();
    });
  }

  /* ---------- riepilogo ---------- */
  function renderSummary() {
    document.getElementById('sumCheckin').textContent = fmt(state.checkIn);
    document.getElementById('sumCheckout').textContent = fmt(state.checkOut);

    var lines = document.getElementById('summaryLines');
    var continueBtn = document.getElementById('continueBtn');
    lines.innerHTML = '';

    if (!state.quote) {
      continueBtn.disabled = true;
      return;
    }
    var q = state.quote;

    function line(label, value, cls) {
      var li = document.createElement('li');
      if (cls) li.className = cls;
      var l = document.createElement('span'); l.textContent = label;
      var v = document.createElement('span'); v.textContent = value;
      li.appendChild(l); li.appendChild(v);
      lines.appendChild(li);
    }

    line(q.nights + ' ' + t('book.nights'), money(q.lodging_total));
    line(t('book.cleaning'), money(q.cleaning_fee));
    line(t('book.total'), money(q.total_price), 'total');
    line(t('book.deposit'), money(q.deposit_amount), 'deposit');
    line(t('book.balance'), money(q.balance_due));
    line(t('book.security'), money(q.security_deposit), 'muted');

    continueBtn.disabled = !(q.available !== false);
  }

  /* ---------- step navigation ---------- */
  function goStep2() {
    document.getElementById('step1').hidden = true;
    document.getElementById('step2').hidden = false;
    document.getElementById('continueBtn').style.display = 'none';
  }
  function goStep1() {
    document.getElementById('step2').hidden = true;
    document.getElementById('step1').hidden = false;
    document.getElementById('continueBtn').style.display = '';
  }

  /* ---------- invio ---------- */
  function submitBooking(e) {
    e.preventDefault();
    var formError = document.getElementById('formError');
    formError.hidden = true;

    var name = document.getElementById('g_name').value.trim();
    var email = document.getElementById('g_email').value.trim();
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      formError.textContent = t('book.required');
      formError.hidden = false;
      return;
    }

    var btn = document.getElementById('confirmBtn');
    btn.disabled = true;
    var prevLabel = btn.textContent;
    btn.textContent = t('book.confirming');

    var payload = {
      room: ROOM_SLUG,
      check_in: state.checkIn,
      check_out: state.checkOut,
      guest_name: name,
      guest_email: email,
      guest_phone: document.getElementById('g_phone').value.trim(),
      num_guests: Number(document.getElementById('g_guests').value) || 1,
      notes: document.getElementById('g_notes').value.trim(),
      lang: state.lang,
    };

    fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (!res.ok) {
          formError.textContent = (res.body && res.body.error) || t('book.error');
          formError.hidden = false;
          btn.disabled = false;
          btn.textContent = prevLabel;
          return;
        }
        state.bookingId = res.body.id;
        state.lastPendingConflict = !!res.body.pending_conflict;
        if (state.pay && state.pay.enabled) {
          showPaymentStep(res.body);
        } else {
          showSuccess(res.body.id, 'book.success.msg');
        }
      })
      .catch(function () {
        formError.textContent = t('book.error');
        formError.hidden = false;
        btn.disabled = false;
        btn.textContent = prevLabel;
      });
  }

  /* ---------- pagamento PayPal ---------- */
  function showSuccess(id, msgKey) {
    document.getElementById('step2').hidden = true;
    document.getElementById('stepPayment').hidden = true;
    document.getElementById('summaryBox').hidden = true;
    var success = document.getElementById('stepSuccess');
    success.hidden = false;
    var msg = t(msgKey, { id: id });
    if (state.lastPendingConflict) msg += '\n\n⚠️ ' + t('book.success.pendingWarn');
    var msgEl = document.getElementById('successMsg');
    msgEl.style.whiteSpace = 'pre-line';
    msgEl.textContent = msg;
  }

  function loadPayPalSdk() {
    if (state.paypalLoaded && window.paypal) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(state.pay.clientId) +
        '&currency=' + encodeURIComponent(state.pay.currency || 'EUR');
      s.onload = function () { state.paypalLoaded = true; resolve(); };
      s.onerror = function () { reject(new Error('paypal sdk')); };
      document.head.appendChild(s);
    });
  }

  function showPayError(msg) {
    var el = document.getElementById('payError');
    if (msg) { el.textContent = msg; el.hidden = false; } else { el.hidden = true; }
  }

  function showPaymentStep(booking) {
    document.getElementById('step2').hidden = true;
    var ps = document.getElementById('stepPayment');
    ps.hidden = false;
    document.getElementById('payInfo').textContent = t('pay.info', { amount: money(booking.deposit_amount) });

    loadPayPalSdk()
      .then(function () { renderPaypalButtons(); })
      .catch(function () { showSuccess(booking.id, 'book.success.msg'); });
  }

  function renderPaypalButtons() {
    var container = document.getElementById('paypalButtons');
    container.innerHTML = '';
    if (!window.paypal) { showSuccess(state.bookingId, 'book.success.msg'); return; }

    window.paypal.Buttons({
      createOrder: function () {
        return fetch('/api/payment/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ booking_id: state.bookingId }),
        })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d && d.orderID) return d.orderID;
            throw new Error((d && d.error) || 'create-order');
          });
      },
      onApprove: function (data) {
        return fetch('/api/payment/capture/' + data.orderID, { method: 'POST' })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
          .then(function (res) {
            if (res.ok && res.body.status === 'confirmed') {
              showSuccess(res.body.id, 'book.success.confirmed');
            } else {
              showPayError((res.body && res.body.error) || t('book.error'));
            }
          });
      },
      onError: function () { showPayError(t('book.error')); },
    }).render('#paypalButtons');
  }

  /* ---------- init ---------- */
  function init() {
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setLang(btn.getAttribute('data-lang')); });
    });
    document.getElementById('calPrev').addEventListener('click', function () {
      state.view = new Date(state.view.getFullYear(), state.view.getMonth() - 1, 1);
      renderCalendar();
    });
    document.getElementById('calNext').addEventListener('click', function () {
      state.view = new Date(state.view.getFullYear(), state.view.getMonth() + 1, 1);
      renderCalendar();
    });
    document.getElementById('continueBtn').addEventListener('click', goStep2);
    document.getElementById('backBtn').addEventListener('click', goStep1);
    document.getElementById('guestForm').addEventListener('submit', submitBooking);

    setLang(detectLang());

    // stato configurazione PayPal (per mostrare o meno il pagamento online)
    fetch('/api/payment/config')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) { if (cfg) state.pay = cfg; })
      .catch(function () {});

    fetchAvailability().then(function (data) {
      if (!data) return;
      state.info = data;
      state.unavailable = {};
      (data.unavailable || []).forEach(function (d) { state.unavailable[d] = true; });
      state.pending = {};
      (data.pending || []).forEach(function (d) { state.pending[d] = true; });

      // popola select ospiti
      var sel = document.getElementById('g_guests');
      sel.innerHTML = '';
      var cap = data.capacity || 4;
      for (var i = 1; i <= cap; i++) {
        var o = document.createElement('option');
        o.value = i; o.textContent = i;
        if (i === 2) o.selected = true;
        sel.appendChild(o);
      }
      renderCalendar();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
