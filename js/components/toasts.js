/* ============================================================
   MTA DevDashboard — components/toasts.js
   Reusable toast notifications.
   ============================================================ */
(function (global) {
  'use strict';
  var MTA = (global.MTA = global.MTA || {});
  var U = MTA.utils;

  var ICONS = {
    success: 'ic-checkc', error: 'ic-alert', warn: 'ic-alert', info: 'ic-info'
  };
  var TITLES = {
    success: 'Success', error: 'Operation failed', warn: 'Warning', info: 'Notice'
  };

  function toast(msg, type, title) {
    type = type || 'success';
    var root = document.getElementById('toast-root');
    if (!root) return;
    var settings = MTA.state && MTA.state.settings;
    var duration = (settings && settings.notifications && settings.notifications.toastDuration) || 3500;

    var el = U.el('div', { class: 'toast ' + type, role: 'status' });
    el.innerHTML =
      '<div class="toast-icon">' + U.icon(ICONS[type] || ICONS.info) + '</div>' +
      '<div class="grow">' +
        '<div class="toast-title">' + U.esc(title || TITLES[type] || '') + '</div>' +
        '<div class="toast-msg">' + (msg || '') + '</div>' +
      '</div>' +
      '<button class="toast-close" aria-label="Dismiss">' + U.icon('ic-close') + '</button>';

    root.appendChild(el);

    var alive = true;
    function kill() {
      if (!alive) return;
      alive = false;
      el.classList.add('out');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 260);
    }
    U.$('.toast-close', el).addEventListener('click', kill);
    el.addEventListener('click', function (e) {
      if (e.target.closest('.toast-close')) return;
      kill();
    });
    setTimeout(kill, duration);
    return el;
  }

  MTA.toast = toast;
})(typeof window !== 'undefined' ? window : this);