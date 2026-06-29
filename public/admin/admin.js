/* Pannello admin Casa Vacanze Leonardo (Fase 7).
   Vanilla JS, fetch same-origin (i cookie di sessione viaggiano in automatico). */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var loginView = $('loginView');
  var dashView = $('dashView');

  var STATUS_LABELS = {
    pending: 'In attesa',
    confirmed: 'Confermata',
    cancelled: 'Annullata',
    completed: 'Completata',
  };
  var STATUS_ORDER = ['pending', 'confirmed', 'completed', 'cancelled'];

  var state = { bookings: [], blocked: [], calRef: new Date() };

  // ---------- Helpers ----------
  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    opts.credentials = 'same-origin';
    return fetch('/api/admin' + path, opts).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error(data.error || ('Errore ' + r.status));
        return data;
      });
    });
  }

  function showMsg(el, text, type) {
    el.textContent = text;
    el.className = 'msg ' + (type || 'ok');
    if (text) {
      setTimeout(function () { if (el.textContent === text) { el.className = 'msg'; el.textContent = ''; } }, 4000);
    }
  }

  function euro(n) { return '€ ' + Number(n || 0).toFixed(2); }

  function fmtDate(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ---------- Auth ----------
  function checkSession() {
    api('/me').then(function (data) {
      if (data.authenticated) {
        $('whoami').textContent = 'Accesso: ' + data.username + '  ';
        loginView.classList.add('hidden');
        dashView.classList.remove('hidden');
        loadAll();
      } else {
        dashView.classList.add('hidden');
        loginView.classList.remove('hidden');
      }
    }).catch(function () {
      loginView.classList.remove('hidden');
    });
  }

  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    api('/login', { method: 'POST', body: JSON.stringify({ username: $('username').value, password: $('password').value }) })
      .then(function () { checkSession(); })
      .catch(function (err) { showMsg($('loginMsg'), err.message, 'error'); });
  });

  $('logoutBtn').addEventListener('click', function () {
    api('/logout', { method: 'POST' }).then(checkSession).catch(checkSession);
  });

  // ---------- Caricamento dati ----------
  function loadAll() {
    loadBookings();
    loadBlocked();
  }

  function loadBookings() {
    var status = $('statusFilter').value;
    api('/bookings' + (status ? '?status=' + status : '')).then(function (data) {
      state.bookings = data.bookings || [];
      renderStats(data.stats || {});
      renderBookings();
      renderCalendar();
    }).catch(function (err) { showMsg($('globalMsg'), err.message, 'error'); });
  }

  function loadBlocked() {
    api('/blocked-dates').then(function (data) {
      state.blocked = data.blocked || [];
      renderBlocked();
      renderCalendar();
    }).catch(function (err) { showMsg($('globalMsg'), err.message, 'error'); });
  }

  // ---------- Render: statistiche ----------
  function renderStats(stats) {
    var html = '';
    STATUS_ORDER.forEach(function (s) {
      html += '<div class="stat"><div class="n">' + (stats[s] || 0) + '</div><div class="l">' + STATUS_LABELS[s] + '</div></div>';
    });
    $('stats').innerHTML = html;
  }

  // ---------- Render: prenotazioni ----------
  function renderBookings() {
    var body = $('bookingsBody');
    var empty = $('bookingsEmpty');
    if (!state.bookings.length) {
      body.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    body.innerHTML = state.bookings.map(function (b) {
      var actions = '';
      if (b.status === 'pending') {
        actions += btn('confirmed', b.id, 'Conferma', 'btn-primary');
        actions += btn('cancelled', b.id, 'Annulla', 'btn-danger');
      } else if (b.status === 'confirmed') {
        actions += btn('completed', b.id, 'Completa', 'btn-ghost');
        actions += btn('cancelled', b.id, 'Annulla', 'btn-danger');
      } else if (b.status === 'cancelled') {
        actions += btn('pending', b.id, 'Ripristina', 'btn-ghost');
      }
      return '<tr>' +
        '<td>' + b.id + '</td>' +
        '<td>' + esc(b.guest_name) + '<div class="muted">' + (b.num_guests || 1) + ' ospiti · ' + (b.lang || 'it').toUpperCase() + '</div></td>' +
        '<td class="muted">' + esc(b.guest_email || '') + '<br>' + esc(b.guest_phone || '') + '</td>' +
        '<td>' + fmtDate(b.check_in) + '<br>→ ' + fmtDate(b.check_out) + '</td>' +
        '<td>' + (b.num_nights || '') + '</td>' +
        '<td>' + euro(b.total_price) + '</td>' +
        '<td>' + euro(b.deposit_amount) + '</td>' +
        '<td><span class="badge ' + b.status + '">' + STATUS_LABELS[b.status] + '</span></td>' +
        '<td><div class="row-actions">' + actions + '</div></td>' +
        '</tr>';
    }).join('');

    Array.prototype.forEach.call(body.querySelectorAll('button[data-id]'), function (el) {
      el.addEventListener('click', function () {
        updateStatus(Number(el.getAttribute('data-id')), el.getAttribute('data-status'));
      });
    });
  }

  function btn(status, id, label, cls) {
    return '<button class="btn btn-sm ' + cls + '" data-id="' + id + '" data-status="' + status + '">' + label + '</button>';
  }

  function updateStatus(id, status) {
    if (status === 'cancelled' && !window.confirm('Annullare la prenotazione #' + id + '? Le date torneranno disponibili.')) return;
    api('/bookings/' + id + '/status', { method: 'PUT', body: JSON.stringify({ status: status }) })
      .then(function () { showMsg($('globalMsg'), 'Prenotazione #' + id + ' → ' + STATUS_LABELS[status], 'ok'); loadBookings(); })
      .catch(function (err) { showMsg($('globalMsg'), err.message, 'error'); });
  }

  // ---------- Render: date bloccate ----------
  function renderBlocked() {
    var body = $('blockedBody');
    if (!state.blocked.length) {
      body.innerHTML = '<tr><td colspan="3" class="muted">Nessuna data bloccata.</td></tr>';
      return;
    }
    body.innerHTML = state.blocked.map(function (r) {
      return '<tr><td>' + fmtDate(r.date) + '</td><td class="muted">' + esc(r.reason || '') + '</td>' +
        '<td><button class="btn btn-sm btn-ghost" data-del="' + r.id + '">Sblocca</button></td></tr>';
    }).join('');
    Array.prototype.forEach.call(body.querySelectorAll('button[data-del]'), function (el) {
      el.addEventListener('click', function () {
        var id = Number(el.getAttribute('data-del'));
        api('/blocked-dates/' + id, { method: 'DELETE' })
          .then(function () { loadBlocked(); })
          .catch(function (err) { showMsg($('globalMsg'), err.message, 'error'); });
      });
    });
  }

  $('blkAdd').addEventListener('click', function () {
    var from = $('blkFrom').value;
    var to = $('blkTo').value || from;
    if (!from) { showMsg($('globalMsg'), 'Seleziona almeno la data iniziale.', 'error'); return; }
    api('/blocked-dates', { method: 'POST', body: JSON.stringify({ from: from, to: to, reason: $('blkReason').value }) })
      .then(function (d) {
        showMsg($('globalMsg'), 'Bloccate ' + d.count + ' date.', 'ok');
        $('blkReason').value = '';
        loadBlocked();
      })
      .catch(function (err) { showMsg($('globalMsg'), err.message, 'error'); });
  });

  // ---------- Calendario ----------
  function occupancySets() {
    var booked = {}; var blocked = {};
    state.bookings.forEach(function (b) {
      if (b.status === 'cancelled') return;
      var d = new Date(b.check_in + 'T00:00:00Z');
      var end = new Date(b.check_out + 'T00:00:00Z'); // escluso
      while (d < end) { booked[d.toISOString().slice(0, 10)] = true; d.setUTCDate(d.getUTCDate() + 1); }
    });
    state.blocked.forEach(function (r) { blocked[String(r.date).slice(0, 10)] = true; });
    return { booked: booked, blocked: blocked };
  }

  function renderCalendar() {
    var dow = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
    $('calDow').innerHTML = dow.map(function (d) { return '<div class="cal-dow">' + d + '</div>'; }).join('');

    var ref = state.calRef;
    var year = ref.getFullYear();
    var month = ref.getMonth();
    var months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    $('calTitle').textContent = months[month] + ' ' + year;

    var first = new Date(Date.UTC(year, month, 1));
    var startDow = (first.getUTCDay() + 6) % 7; // lun=0
    var daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    var occ = occupancySets();
    var today = todayISO();

    var cells = '';
    for (var i = 0; i < startDow; i++) cells += '<div class="cal-cell empty"></div>';
    for (var day = 1; day <= daysInMonth; day++) {
      var iso = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      var cls = 'cal-cell';
      if (occ.booked[iso]) cls += ' booked';
      else if (occ.blocked[iso]) cls += ' blocked';
      if (iso < today) cls += ' past';
      cells += '<div class="' + cls + '" title="' + iso + '">' + day + '</div>';
    }
    $('calGrid').innerHTML = cells;
  }

  $('calPrev').addEventListener('click', function () { state.calRef = new Date(state.calRef.getFullYear(), state.calRef.getMonth() - 1, 1); renderCalendar(); });
  $('calNext').addEventListener('click', function () { state.calRef = new Date(state.calRef.getFullYear(), state.calRef.getMonth() + 1, 1); renderCalendar(); });
  $('statusFilter').addEventListener('change', loadBookings);
  $('reloadBtn').addEventListener('click', loadAll);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Avvio
  checkSession();
})();
