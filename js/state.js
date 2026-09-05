/* ============================================================
   MTA DevDashboard — state.js
   Lightweight reactive state + event bus.
   ============================================================ */
(function (global) {
  'use strict';
  var MTA = (global.MTA = global.MTA || {});
  var ST = {};

  ST.listeners = {};
  ST.currentUser = null;
  ST.settings = null;
  ST.theme = 'ivory';

  /* ---------- Event bus ---------- */
  ST.on = function (ev, fn) {
    if (!ST.listeners[ev]) ST.listeners[ev] = [];
    ST.listeners[ev].push(fn);
    return function off() {
      var arr = ST.listeners[ev];
      if (!arr) return;
      var i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    };
  };

  ST.emit = function (ev, payload) {
    var arr = ST.listeners[ev];
    if (arr) arr.slice().forEach(function (fn) {
      try { fn(payload); } catch (e) { console.error('[state:' + ev + ']', e); }
    });
  };

  /* ---------- Settings ---------- */
  ST.loadSettings = function () {
    var s = MTA.store.settings();
    ST.settings = s;
    ST.applyAppearance();
    return s;
  };

  ST.saveSettings = function (s) {
    ST.settings = s;
    MTA.store.saveSettings(s);
    ST.applyAppearance();
    ST.emit('settings', s);
  };

  ST.updateSettings = function (pathParts, value) {
    var s = ST.settings || ST.loadSettings();
    var node = s;
    for (var i = 0; i < pathParts.length - 1; i++) {
      node = node[pathParts[i]];
      if (!node) return;
    }
    node[pathParts[pathParts.length - 1]] = value;
    ST.saveSettings(s);
  };

  /* ---------- Theme ---------- */
  ST.setTheme = function (t, opts) {
    t = t === 'charcoal' ? 'charcoal' : 'ivory';
    ST.theme = t;
    MTA.store.saveTheme(t);
    if (opts && opts.persist !== false && ST.settings && ST.settings.appearance) {
      ST.settings.appearance.theme = t;
      MTA.store.saveSettings(ST.settings);
    }
    document.documentElement.setAttribute('data-theme', t);
    ST.emit('theme', t);
  };

  ST.toggleTheme = function () {
    ST.setTheme(ST.theme === 'charcoal' ? 'ivory' : 'charcoal', { persist: true });
  };

  /* Apply appearance knobs (font size, ui scale, motion, animations). */
  ST.applyAppearance = function () {
    var s = ST.settings;
    if (!s || !s.appearance) return;
    var a = s.appearance;
    document.documentElement.style.setProperty('--font-ratio', (a.fontSize / 16).toFixed(3));
    document.documentElement.style.setProperty('--ui-scale', String(a.uiScale || 1));
    document.documentElement.classList.toggle('reduce-motion', !!a.reducedMotion);
    document.documentElement.classList.toggle('ui-animations-off', a.animations === false);
    var t = a.theme === 'charcoal' ? 'charcoal' : 'ivory';
    document.documentElement.setAttribute('data-theme', t);
    ST.theme = t;
  };

  /* ---------- User ---------- */
  ST.setUser = function (u) {
    ST.currentUser = u;
    ST.emit('user', u);
  };

  ST.getUser = function () {
    return ST.currentUser;
  };

  /* ---------- Re-read store & notify (used after CRUD) ---------- */
  ST.bump = function (ev) {
    ST.emit(ev || 'data');
  };

  MTA.state = ST;
})(typeof window !== 'undefined' ? window : this);