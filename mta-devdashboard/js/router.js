/* ============================================================
   MTA DevDashboard - router.js
   Hash-based router with permission guards.
   ============================================================ */
(function (global) {
  'use strict';
  var MTA = (global.MTA = global.MTA || {});
  var R = {};

  var current = 'dashboard';

  /* Resolve hash like "#/projects" -> { page:'projects', id:null } */
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/');
    var page = (parts[0] || 'dashboard').toLowerCase();
    var id = parts[1] || null;
    return { page: page, id: id };
  }

  R.getCurrent = function () { return current; };

  /* Route dispatch. Returns true when allowed, false for denied. */
  R.resolve = function (hash) {
    var parsed = hash || parseHash();
    R._lastParsed = parsed;
    var page = parsed.page || 'dashboard';
    var user = MTA.state.currentUser;

    /* valid page? */
    var pageDef = MTA.permissions.getPage(page);

    /* access control */
    if (!user || user.status !== 'active') {
      if (MTA.app && MTA.app.showAuth) MTA.app.showAuth(null);
      return false;
    }
    if (MTA.state.locked) {
      if (MTA.app && MTA.app.showAuth) MTA.app.showAuth('lock');
      return false;
    }
    if (!MTA.permissions.canAccess(user, page)) {
      R.renderDenied();
      current = page;
      return false;
    }
    if (!pageDef) {
      R.renderDenied();
      current = page;
      return false;
    }

    current = page;
    var main = document.getElementById('app-main');
    var rendererMap = {
      dashboard: 'dashboard',
      projects: 'projects',
      devnote: 'devnote',
      tasks: 'tasks',
      activity: 'activity',
      calendar: 'calendar',
      admins: 'admins',
      settings: 'settings'
    };

    var mod = MTA.modules && MTA.modules[rendererMap[page]]
      ? MTA.modules[rendererMap[page]]
      : MTA[rendererMap[page]];

    if (mod && mod.render) {
      try {
        mod.render(main);
        MTA.state.emit('route', page);
        if (MTA.app) {
          MTA.app.updateNav();
          MTA.app.updateHeader();
          MTA.app.trackNavigation(page);
        }
        if (page === 'dashboard' && MTA.charts && MTA.charts.redrawAll) {
          setTimeout(MTA.charts.redrawAll, 50);
        }
        return true;
      } catch (err) {
        console.error('[router] render error on ' + page, err);
        main.innerHTML = '<div class="page"><div class="empty"><div class="empty-ic">' +
          MTA.utils.icon('ic-alert') + '</div><h3>Something went wrong</h3>' +
          '<p>' + MTA.utils.esc(String(err && err.message)) + '</p></div></div>';
        return true;
      }
    }

    R.renderDenied();
    return false;
  };

  R.renderDenied = function () {
    var main = document.getElementById('app-main');
    if (!main) return;
    main.innerHTML =
      '<div class="page"><div class="denied-wrap"><div class="card denied-box">' +
        '<div class="denied-icon">' + MTA.utils.icon('ic-lock') + '</div>' +
        '<h2>Access denied</h2>' +
        '<p class="small muted">Your current admin account does not have permission to view this section.</p>' +
        '<div class="empty-actions">' +
          '<button class="btn btn-primary" data-goto-dashboard>' + MTA.utils.icon('ic-dashboard') + ' Go to dashboard</button>' +
        '</div>' +
      '</div></div></div>';
    var btn = main.querySelector('[data-goto-dashboard]');
    if (btn) btn.addEventListener('click', function () { R.goto('dashboard'); });
  };

  R.goto = function (page, id) {
    var target = '#/' + page + (id ? '/' + encodeURIComponent(id) : '');
    if (location.hash === target) {
      /* re-render current route */
      R.resolve(parseHash());
      return;
    }
    location.hash = target;
  };

  function hashchange() {
    R.resolve(parseHash());
  }

  R.init = function () {
    /* start on dashboard hash unless the user already has one */
    if (!location.hash) location.hash = '#/dashboard';
    global.addEventListener('hashchange', hashchange);
    R.resolve(parseHash());
  };

  MTA.router = R;
})(typeof window !== 'undefined' ? window : this);