/**
 * Logica frontend pubblico (Fase 3):
 *  - selettore lingua + applicazione traduzioni (data-i18n)
 *  - fetch dei dati dell'appartamento (/api/rooms/:slug)
 *  - galleria + lightbox
 *  - menu mobile
 */
(function () {
  'use strict';

  var ROOM_SLUG = 'casa-vacanze-leonardo';
  var AMENITY_ICONS = {
    parking: '🚗',
    kitchen: '🍳',
    utilities_included: '💡',
    two_bedrooms: '🛏️',
    garden: '🌿',
    veranda: '⛱️',
    outdoor_shower: '🚿',
  };

  var state = { lang: window.DEFAULT_LANG, room: null };

  /* ---------- i18n ---------- */
  function t(key) {
    var dict = window.I18N[state.lang] || window.I18N[window.DEFAULT_LANG];
    return (dict && dict[key]) || key;
  }

  function applyTranslations() {
    document.documentElement.lang = state.lang;

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });

    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      // formato: "placeholder:chiave;title:chiave2"
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var parts = pair.split(':');
        if (parts.length === 2) el.setAttribute(parts[0].trim(), t(parts[1].trim()));
      });
    });

    // title del documento
    var titleEl = document.querySelector('title[data-i18n]');
    if (titleEl) document.title = t(titleEl.getAttribute('data-i18n'));

    // contenuti che dipendono dai dati (descrizione, amenities)
    renderRoomDescription();
    renderAmenities();
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

  /* ---------- Dati appartamento ---------- */
  function fetchRoom() {
    return fetch('/api/rooms/' + ROOM_SLUG)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { state.room = data; })
      .catch(function () { state.room = null; });
  }

  function renderRoomDescription() {
    var el = document.getElementById('roomDescription');
    if (!el) return;
    if (!state.room) { el.textContent = t('common.loading'); return; }
    var key = 'description_' + state.lang;
    el.textContent = state.room[key] || state.room.description_it || '';
  }

  function renderAmenities() {
    var grid = document.getElementById('amenitiesGrid');
    if (!grid) return;
    var list = (state.room && state.room.amenities) || Object.keys(AMENITY_ICONS);
    grid.innerHTML = '';
    list.forEach(function (key) {
      var li = document.createElement('li');
      var ico = document.createElement('span');
      ico.className = 'am-ico';
      ico.textContent = AMENITY_ICONS[key] || '✔️';
      var label = document.createElement('span');
      label.textContent = t('amenity.' + key);
      li.appendChild(ico);
      li.appendChild(label);
      grid.appendChild(li);
    });
  }

  function renderGallery() {
    var grid = document.getElementById('galleryGrid');
    if (!grid) return;
    var images = (state.room && state.room.images && state.room.images.length)
      ? state.room.images
      : ['/images/hero.jpg'];
    grid.innerHTML = '';
    images.forEach(function (src) {
      var fig = document.createElement('figure');
      var img = document.createElement('img');
      img.src = src;
      img.alt = 'Casa Vacanze Leonardo';
      img.loading = 'lazy';
      fig.appendChild(img);
      fig.addEventListener('click', function () { openLightbox(src); });
      grid.appendChild(fig);
    });
  }

  /* ---------- Lightbox ---------- */
  function openLightbox(src) {
    var lb = document.getElementById('lightbox');
    var img = document.getElementById('lightboxImg');
    img.src = src;
    lb.hidden = false;
  }
  function closeLightbox() {
    var lb = document.getElementById('lightbox');
    lb.hidden = true;
    document.getElementById('lightboxImg').src = '';
  }

  /* ---------- Init ---------- */
  function init() {
    // anno footer
    var yr = document.getElementById('year');
    if (yr) yr.textContent = new Date().getFullYear();

    // selettore lingua
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setLang(btn.getAttribute('data-lang')); });
    });

    // menu mobile
    var toggle = document.getElementById('navToggle');
    var nav = document.getElementById('mainNav');
    if (toggle && nav) {
      toggle.addEventListener('click', function () { nav.classList.toggle('open'); });
      nav.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () { nav.classList.remove('open'); });
      });
    }

    // lightbox
    var lbClose = document.getElementById('lightboxClose');
    var lb = document.getElementById('lightbox');
    if (lbClose) lbClose.addEventListener('click', closeLightbox);
    if (lb) lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLightbox(); });

    // lingua iniziale + dati
    setLang(detectLang());
    fetchRoom().then(function () {
      renderRoomDescription();
      renderAmenities();
      renderGallery();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
