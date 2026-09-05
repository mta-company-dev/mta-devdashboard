/* ============================================================
   MTA DevDashboard - app.js
   Boot, shell (sidebar/header), auth screens, global search,
   keyboard shortcuts, online status, clock, idle lock.
   ============================================================ */
(function (global) {
  'use strict';
  var MTA = (global.MTA = global.MTA || {});
  var U = MTA.utils;
  var APP = {};
  MTA.app = APP;

  var authView, authBox, shell, main, sidebar, header, bottomNav;

  /* ============================================================
     AUTH SCREEN
     ============================================================ */
  APP.showAuth = function (mode) {
    authView = authView || document.getElementById('auth-view');
    authBox = authBox || document.getElementById('auth-box');
    shell = shell || document.getElementById('shell');
    main = main || document.getElementById('app-main');

    var isLock = mode === 'lock';
    authView.hidden = false;
    shell.hidden = true;

    var sub = document.getElementById('auth-sub');
    if (isLock) sub.innerHTML = '<span class="lock-badge-chip">' + U.icon('ic-lock') + ' Session locked</span>';
    else sub.textContent = 'Sign in to your developer workspace';

    authBox.innerHTML = isLock ? lockFormHtml() : loginFormHtml();

    var form = authBox.querySelector('form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        submitAuth(isLock, authBox);
      });
      var first = authBox.querySelector('input');
      setTimeout(function () { first && first.focus(); }, 40);
    }
  };

  function loginFormHtml() {
    var remember = MTA.state.settings && MTA.state.settings.security
      ? MTA.state.settings.security.remember !== false : true;
    return '<form class="auth-form" autocomplete="on">' +
      '<div class="field"><label class="field-label" for="auth-user">Username</label>' +
        '<input class="input" id="auth-user" name="username" autocomplete="username" required placeholder="username"></div>' +
      '<div class="field"><label class="field-label" for="auth-pass">Password</label>' +
        '<div class="row pw-row"><input class="input" id="auth-pass" name="password" type="password" autocomplete="current-password" required placeholder="password">' +
        '<button type="button" class="pw-toggle js-pw" aria-label="Show password">' + U.icon('ic-eyeoff') + '</button></div></div>' +
      '<label class="ck" style="margin-bottom:6px"><input type="checkbox" id="auth-remember"' + (remember ? ' checked' : '') + '><span>Keep me signed in</span></label>' +
      '<div class="auth-error" id="auth-error" hidden></div>' +
      '<button class="btn btn-primary btn-lg btn-block" type="submit">' + U.icon('ic-lock') + ' Sign in</button>' +
    '</form>';
  }

  function lockFormHtml() {
    var u = MTA.state.currentUser;
    return '<form class="auth-form">' +
      '<div class="row" style="justify-content:center;margin-bottom:8px"><span class="hdr-avatar" style="width:56px;height:56px">' +
        (u && u.avatar ? '<img src="' + u.avatar + '" alt="">' : U.esc(U.initials(u ? (u.displayName || u.username) : ''))) +
      '</span></div>' +
      '<div style="text-align:center"><b>' + U.esc(u ? (u.displayName || u.username) : '') + '</b>' +
      '<div class="small muted">Enter your password to unlock.</div></div>' +
      '<div class="field" style="margin-top:14px"><label class="field-label" for="auth-pass">Password</label>' +
        '<div class="row pw-row"><input class="input" id="auth-pass" type="password" autocomplete="current-password" required placeholder="Password">' +
        '<button type="button" class="pw-toggle js-pw" aria-label="Show password">' + U.icon('ic-eyeoff') + '</button></div></div>' +
      '<div class="auth-error" id="auth-error" hidden></div>' +
      '<button class="btn btn-primary btn-lg btn-block" type="submit">' + U.icon('ic-unlock') + ' Unlock</button>' +
      '<button class="btn btn-ghost btn-block" type="button" data-switch-user>Switch account</button>' +
    '</form>';
  }

  function submitAuth(isLock, box) {
    var errBox = box.querySelector('#auth-error');
    var pass = box.querySelector('#auth-pass').value;
    if (isLock) {
      var r = MTA.auth.unlock(pass);
      if (!r.ok) { showAuthError(errBox, r.error); return; }
      MTA.toast('Welcome back', 'success');
      APP.resumeApp();
      return;
    }
    var username = box.querySelector('#auth-user').value;
    var remember = box.querySelector('#auth-remember') ? box.querySelector('#auth-remember').checked : true;
    var res = MTA.auth.login(username, pass, remember);
    if (!res.ok) { showAuthError(errBox, res.error); return; }
    MTA.toast('Welcome, ' + (res.user.displayName || res.user.username), 'success');
    APP.bootApp();
  }

  function showAuthError(errBox, msg) {
    errBox.hidden = false;
    errBox.innerHTML = U.icon('ic-alert') + U.esc(msg);
    setTimeout(function () { errBox.hidden = true; }, 4000);
  }

  /* shared handlers: password reveal + switch account */
  document.addEventListener('click', function (e) {
    var pw = e.target.closest('.js-pw');
    if (pw) {
      var input = pw.parentNode.querySelector('input');
      if (input) {
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        pw.innerHTML = U.icon(show ? 'ic-eye' : 'ic-eyeoff');
      }
      return;
    }
    var sw = e.target.closest('[data-switch-user]');
    if (sw) {
      MTA.auth.destroySession();
      APP.showAuth(null);
    }
  });

  APP.hideAuth = function () {
    authView = authView || document.getElementById('auth-view');
    authView.hidden = true;
  };

  /* ============================================================
     SIDEBAR + BOTTOM NAV
     ============================================================ */
  APP.renderSidebar = function () {
    sidebar = sidebar || document.getElementById('sidebar');
    bottomNav = bottomNav || document.getElementById('bottom-nav');
    var user = MTA.state.currentUser;
    var pages = MTA.permissions.allowedPages(user);
    var current = MTA.router.getCurrent();

    var mainGroup = pages.filter(function (p) { return p.section === 'main'; });
    var sysGroup = pages.filter(function (p) { return p.section === 'system'; });

    function linkHtml(p) {
      return '<a class="sb-link' + (current === p.id ? ' active' : '') + '" href="#/' + p.id + '" data-page="' + p.id + '">' +
        U.icon(p.icon) + '<span class="sb-label">' + p.label + '</span>' +
        '<span class="kbd-hint">' + shortcutHint(p.id) + '</span></a>';
    }

    var nav = '';
    if (mainGroup.length) {
      nav += '<div class="sb-group">Main</div>' + mainGroup.map(linkHtml).join('');
    }
    if (sysGroup.length) {
      nav += '<div class="sb-group">System</div>' + sysGroup.map(linkHtml).join('');
    }

    sidebar.innerHTML =
      '<div class="sb-brand"><span class="sb-logo">MTA</span>' +
        '<span class="sb-brand-text"><b>DevDashboard</b><span>Developer Toolkit</span></span></div>' +
      '<nav class="sb-nav" aria-label="Main">' + nav + '</nav>' +
      '<div class="sb-foot"><p>Developed by MTA Company</p></div>';

    var bnPages = mainGroup.slice(0, 5);
    bottomNav.innerHTML = bnPages.map(function (p) {
      return '<a class="bn-item' + (current === p.id ? ' active' : '') + '" href="#/' + p.id + '" aria-label="' + p.label + '">' +
        U.icon(p.icon) + '<span>' + p.label + '</span></a>';
    }).join('');
  };

  function shortcutHint(page) {
    var sc = MTA.state.settings && MTA.state.settings.shortcuts;
    if (!sc) return '';
    var map = { dashboard: 'dashboard', projects: 'projects', devnote: 'devnote', tasks: 'tasks', activity: 'activity', calendar: 'calendar', settings: 'settings' };
    var key = map[page];
    var seq = key && sc[key] ? sc[key] : null;
    return seq ? seq.replace(/\+/g, ' ') : '';
  }

  /* ============================================================
     HEADER
     ============================================================ */
  APP.renderHeader = function () {
    shell = shell || document.getElementById('shell');
    header = header || document.getElementById('app-header');
    var user = MTA.state.currentUser;
    var page = MTA.router.getCurrent();
    var pageDef = MTA.permissions.getPage(page);

    var avatar = user && user.avatar
      ? '<span class="hdr-avatar"><img src="' + user.avatar + '" alt=""></span>'
      : '<span class="hdr-avatar">' + U.esc(U.initials(user ? (user.displayName || user.username) : '?')) + '</span>';

    header.innerHTML =
      '<button class="icon-btn js-sidebar-toggle" aria-label="Toggle navigation">' + U.icon('ic-menu') + '</button>' +
      '<div class="hdr-greeting">' + avatar +
        '<div><div class="g-title">' + U.esc(user ? (user.displayName || user.username) : '') + '</div>' +
        '<div class="g-sub">' + U.esc(pageDef ? pageDef.label : '') + '</div></div>' +
      '</div>' +
      '<div class="hdr-actions">' +
        '<span class="hdr-chip status-chip"><span class="dot"></span><span id="net-label">Online</span></span>' +
        '<span class="hdr-chip wifi-chip" id="net-ic">' + U.icon('ic-wifi') + '<span>WiFi</span></span>' +
        '<span class="hdr-chip clock-chip" id="hdr-clock" title="Current time"></span>' +
        '<button class="icon-btn" id="btn-search" aria-label="Global search (Ctrl+K)" title="Global search">' + U.icon('ic-search') + '</button>' +
        '<button class="icon-btn" id="btn-theme" aria-label="Toggle theme" title="Toggle theme">' +
          U.icon(MTA.state.theme === 'charcoal' ? 'ic-sun' : 'ic-moon') + '</button>' +
        '<div class="drop" id="user-drop-wrap"><button class="icon-btn" id="user-drop" aria-label="Account menu" aria-haspopup="true">' + U.icon('ic-more') + '</button></div>' +
      '</div>';

    U.$('#btn-search', header).addEventListener('click', APP.openSearch);
    U.$('#btn-theme', header).addEventListener('click', function () {
      MTA.state.toggleTheme();
      APP.renderHeader();
      MTA.toast(MTA.state.theme === 'charcoal' ? 'Charcoal Dark enabled' : 'Ivory Light enabled', 'info', 'Theme');
    });
    U.$('.js-sidebar-toggle', header).addEventListener('click', APP.toggleSidebar);
    U.$('#user-drop', header).addEventListener('click', function (e) {
      e.stopPropagation();
      var existing = header.querySelector('.drop-menu');
      if (existing) { existing.remove(); return; }
      var menu = U.el('div', { class: 'drop-menu' });
      menu.innerHTML =
        '<div class="drop-label">' + U.esc(user ? (user.displayName || user.username) : '') + '</div>' +
        '<button class="drop-item" data-user-settings>' + U.icon('ic-settings') + ' Settings</button>' +
        '<button class="drop-item" data-user-lock>' + U.icon('ic-lock') + ' Lock session</button>' +
        '<div class="drop-sep"></div>' +
        '<button class="drop-item danger" data-user-logout>' + U.icon('ic-logout') + ' Sign out</button>';
      U.$('#user-drop-wrap', header).appendChild(menu);
      U.$('[data-user-settings]', menu).addEventListener('click', function () { menu.remove(); MTA.router.goto('settings'); });
      U.$('[data-user-lock]', menu).addEventListener('click', function () { menu.remove(); MTA.auth.lock(); });
      U.$('[data-user-logout]', menu).addEventListener('click', function () {
        menu.remove();
        MTA.modal.confirm({ title: 'Sign out', message: 'Sign out of the dashboard?' }).then(function (ok) {
          if (!ok) return;
          MTA.auth.logout();
          APP.showAuth(null);
        });
      });
    });
  };

  /* close dropdowns on outside click */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.drop-menu') && !e.target.closest('#user-drop')) {
      document.querySelectorAll('.drop-menu').forEach(function (m) { m.remove(); });
    }
  });

  /* ============================================================
     SIDEBAR TOGGLE / CLOCK / NETWORK
     ============================================================ */
  APP.toggleSidebar = function () {
    var html = document.documentElement;
    if (window.matchMedia('(max-width: 900px)').matches) {
      html.classList.toggle('sb-open');
      return;
    }
    var collapsed = html.classList.toggle('sb-collapsed');
    if (MTA.state.settings && MTA.state.settings.appearance) {
      MTA.state.settings.appearance.sidebar = collapsed ? 'collapsed' : 'expanded';
      MTA.store.saveSettings(MTA.state.settings);
    }
  };

  APP.updateNav = function () {
    var current = MTA.router.getCurrent();
    document.querySelectorAll('.sb-link').forEach(function (a) {
      a.classList.toggle('active', a.dataset.page === current);
    });
    document.querySelectorAll('.bn-item').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('href') === '#/' + current);
    });
  };

  APP.updateHeader = function () {
    var page = MTA.router.getCurrent();
    var pageDef = MTA.permissions.getPage(page);
    var sub = header && header.querySelector('.g-sub');
    if (sub && pageDef) sub.textContent = pageDef.label;
  };

  APP.trackNavigation = function (page) {
    if (!MTA.activity) return;
    var now = Date.now();
    if (APP._lastNav && APP._lastNav.page === page && now - APP._lastNav.at < 800) return;
    APP._lastNav = { page: page, at: now };
    MTA.activity.track('navigation', 'Opened ' + page + ' section', { page: page });
  };

  function startClock() {
    var el = document.getElementById('hdr-clock');
    if (!el) return;
    function tick() {
      var d = new Date();
      el.innerHTML = U.icon('ic-clock') + ' ' + U.fmtTime(d) + ' <span class="tiny muted">' +
        d.getDate() + ' ' + U.monthName(d.getMonth()).slice(0, 3) + '</span>';
      el.title = U.fmtDateTime(d);
    }
    tick();
    setInterval(tick, 30000);
  }

  function initNetwork() {
    function setOnline(on) {
      var chip = document.querySelector('.status-chip');
      var netIc = document.getElementById('net-ic');
      var label = document.getElementById('net-label');
      if (chip) chip.classList.toggle('offline', !on);
      if (label) label.textContent = on ? 'Online' : 'Offline';
      if (netIc) netIc.innerHTML = U.icon(on ? 'ic-wifi' : 'ic-wifi-off') + '<span>' + (on ? 'WiFi' : 'No connection') + '</span>';
    }
    window.addEventListener('online', function () { setOnline(true); MTA.toast('Back online', 'success'); });
    window.addEventListener('offline', function () { setOnline(false); MTA.toast('You are offline — changes are kept locally.', 'warn'); });
    setOnline(navigator.onLine !== false);
  }

  /* ============================================================
     GLOBAL SEARCH (Ctrl+K)
     ============================================================ */
  APP.openSearch = function () {
    var root = document.getElementById('palette-root');
    if (!root || root.innerHTML) return;

    var overlay = U.el('div', { class: 'palette-overlay' });
    var palette = U.el('div', { class: 'palette', role: 'dialog', 'aria-label': 'Search' });
    palette.innerHTML =
      '<div class="palette-input-wrap"><svg class="ic" aria-hidden="true"><use href="#ic-search"></use></svg>' +
        '<input class="palette-input" id="pl-input" placeholder="Search everything..." autocomplete="off" aria-label="Search">' +
        '<span class="small muted"><kbd>Esc</kbd></span></div>' +
      '<div class="palette-tabs" id="pl-tabs">' +
        '<button data-scope="all" class="active">All</button>' +
        '<button data-scope="projects">Projects</button>' +
        '<button data-scope="notes">Notes</button>' +
        '<button data-scope="tasks">Tasks</button>' +
        '<button data-scope="events">Events</button>' +
        '<button data-scope="settings">Settings</button>' +
      '</div>' +
      '<div class="palette-list" id="pl-list"></div>';
    overlay.appendChild(palette);
    root.appendChild(overlay);

    var input = U.$('#pl-input', palette);
    var listEl = U.$('#pl-list', palette);
    var scope = 'all';
    var results = [];
    var activeIdx = 0;

    function tabsVisible(key) {
      return scope === 'all' || scope === key;
    }

    function collect(q) {
      var lq = q.toLowerCase();
      var out = [];
      var user = MTA.state.currentUser;
      var allowed = MTA.permissions.allowedIds(user);

      if (scope === 'all' || scope === 'settings') {
        MTA.permissions.PAGES.forEach(function (p) {
          if (allowed.indexOf(p.id) < 0) return;
          if (!lq || p.label.toLowerCase().indexOf(lq) >= 0 || p.id.indexOf(lq) >= 0) {
            out.push({ kind: 'page', title: p.label, icon: p.icon, cat: 'Go to', goto: function () { window.location.hash = '#/' + p.id; } });
          }
        });
      }
      if (scope === 'all' || scope === 'settings') {
        var actions = [
          { title: 'New project', icon: 'ic-plus', fn: function () { window.location.hash = '#/projects'; setTimeout(function () { var b = document.querySelector('#pj-new'); if (b) b.click(); }, 80); } },
          { title: 'New task', icon: 'ic-plus', fn: function () { window.location.hash = '#/tasks'; setTimeout(function () { var b = document.querySelector('#tk-new'); if (b) b.click(); }, 80); } },
          { title: 'New note', icon: 'ic-plus', fn: function () { window.location.hash = '#/devnote'; } },
          { title: 'New event', icon: 'ic-plus', fn: function () { window.location.hash = '#/calendar'; } }
        ];
        actions.forEach(function (a) {
          if (!lq || a.title.toLowerCase().indexOf(lq) >= 0) {
            out.push({ kind: 'action', title: a.title, icon: a.icon, cat: 'Action', goto: a.fn });
          }
        });
      }

      var idMap = { projects: 'projects', notes: 'devnote', tasks: 'tasks', events: 'calendar' };
      if (tabsVisible('projects') && allowed.indexOf('projects') >= 0) {
        MTA.store.projects().forEach(function (p) {
          var hay = (p.name + ' ' + (p.description || '') + ' ' + (p.tags || []).join(' ') + ' ' + (p.category || '')).toLowerCase();
          if (!lq || hay.indexOf(lq) >= 0) {
            out.push({ kind: 'project', title: p.name, icon: 'ic-folder', cat: p.status, goto: function () { window.location.hash = '#/projects/' + encodeURIComponent(p.id); } });
          }
        });
      }
      if (tabsVisible('notes') && allowed.indexOf('devnote') >= 0) {
        MTA.store.notes().forEach(function (n) {
          var hay = (n.title + ' ' + (n.subtitle || '') + ' ' + U.stripHtml(n.content) + ' ' + (n.tags || []).join(' ')).toLowerCase();
          if (!lq || hay.indexOf(lq) >= 0) {
            out.push({ kind: 'note', title: n.title, icon: 'ic-note', cat: n.category || 'Note', goto: function () { window.location.hash = '#/devnote/' + encodeURIComponent(n.id); } });
          }
        });
      }
      if (tabsVisible('tasks') && allowed.indexOf('tasks') >= 0) {
        MTA.store.tasks().forEach(function (t) {
          var hay = (t.title + ' ' + (t.description || '') + ' ' + (t.tags || []).join(' ')).toLowerCase();
          if (!lq || hay.indexOf(lq) >= 0) {
            out.push({ kind: 'task', title: t.title, icon: 'ic-tasks', cat: t.status, goto: function () { window.location.hash = '#/tasks'; } });
          }
        });
      }
      if (tabsVisible('events') && allowed.indexOf('calendar') >= 0) {
        MTA.store.events().forEach(function (e) {
          var hay = (e.title + ' ' + (e.description || '')).toLowerCase();
          if (!lq || hay.indexOf(lq) >= 0) {
            out.push({ kind: 'event', title: e.title, icon: 'ic-calendar', cat: U.fmtDate(e.start), goto: function () { window.location.hash = '#/calendar'; } });
          }
        });
      }
      return out;
    }

    function render() {
      var q = input.value.trim();
      results = collect(q);
      activeIdx = 0;
      if (!results.length) {
        listEl.innerHTML = '<div class="palette-empty">' + U.icon('ic-search') + ' No results for "' + U.esc(q || '') + '"</div>';
        return;
      }
      listEl.innerHTML = results.map(function (r, i) {
        return '<button class="palette-item' + (i === activeIdx ? ' active' : '') + '" data-idx="' + i + '">' +
          '<span class="p-ic">' + U.icon(r.icon) + '</span>' +
          '<span class="p-title">' + U.esc(r.title) + '</span>' +
          '<span class="p-cat">' + U.esc(r.cat) + '</span></button>';
      }).join('');
      listEl.querySelectorAll('[data-idx]').forEach(function (b) {
        b.addEventListener('click', function () {
          results[+b.dataset.idx].goto();
          APP.closeSearch();
        });
        b.addEventListener('mouseenter', function () {
          activeIdx = +b.dataset.idx;
          refreshActive();
        });
      });
    }

    function refreshActive() {
      listEl.querySelectorAll('[data-idx]').forEach(function (b) {
        b.classList.toggle('active', +b.dataset.idx === activeIdx);
      });
      var active = listEl.querySelector('[data-idx="' + activeIdx + '"]');
      if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
    }

    input.addEventListener('input', render);
    render();

    U.$$('[data-scope]', palette).forEach(function (b) {
      b.addEventListener('click', function () {
        scope = b.dataset.scope;
        U.$$('[data-scope]', palette).forEach(function (x) { x.classList.toggle('active', x === b); });
        render();
      });
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (results.length) { activeIdx = Math.min(results.length - 1, activeIdx + 1); refreshActive(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(0, activeIdx - 1); refreshActive(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (results[activeIdx]) { results[activeIdx].goto(); APP.closeSearch(); } }
      else if (e.key === 'Escape') { e.preventDefault(); APP.closeSearch(); }
    });
    input.focus();
  };

  APP.closeSearch = function () {
    var root = document.getElementById('palette-root');
    if (root) root.innerHTML = '';
  };

  /* ============================================================
     KEYBOARD SHORTCUTS
     ============================================================ */
  APP.bindShortcuts = function () {
    var sc = MTA.state.settings && MTA.state.settings.shortcuts;
    if (!sc) sc = MTA.store.defaultSettings().shortcuts;
    var mapping = {};
    Object.keys(sc).forEach(function (k) { mapping[sc[k]] = k; });

    document.addEventListener('keydown', function (e) {
      /* skip when typing */
      var tag = e.target && e.target.tagName;
      var typing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable);
      var key = '';
      if (e.ctrlKey || e.metaKey) key += 'ctrl+';
      if (e.altKey) key += 'alt+';
      if (e.shiftKey) key += 'shift+';
      var k = e.key.toLowerCase();
      if (k === 'control' || k === 'meta' || k === 'alt' || k === 'shift') return;
      key += k === ' ' ? 'space' : k;

      var action = mapping[key];
      if (!action) return;

      /* don't hijack typing shortcuts except global search etc. */
      if (typing && action !== 'global-search' && action !== 'save' && action !== 'command-palette') return;

      e.preventDefault();

      switch (action) {
        case 'global-search': if (!typing) APP.openSearch(); break;
        case 'command-palette': APP.openPalette(); break;
        case 'save':
          if (typing) {
            var note = MTA.devnote && MTA.devnote._saveNow;
            if (note) { note(); MTA.toast('Note saved', 'success'); }
          }
          break;
        case 'new-item':
          var page = MTA.router.getCurrent();
          if (page === 'projects') { var b1 = document.querySelector('#pj-new'); if (b1) b1.click(); }
          else if (page === 'tasks') { var b2 = document.querySelector('#tk-new'); if (b2) b2.click(); }
          else if (page === 'devnote') { var b3 = document.querySelector('#dn-new'); if (b3) b3.click(); }
          else if (page === 'calendar') { var b4 = document.querySelector('#ev-new'); if (b4) b4.click(); }
          break;
        default:
          if (MTA.permissions.SHORTCUT_NAV[action]) {
            MTA.router.goto(MTA.permissions.SHORTCUT_NAV[action]);
          }
      }
    });
  };

  /* ============================================================
     COMMAND PALETTE (Ctrl+Shift+P)
     ============================================================ */
  APP.openPalette = function () {
    var root = document.getElementById('palette-root');
    if (!root) return;
    var overlay = U.el('div', { class: 'palette-overlay' });
    var palette = U.el('div', { class: 'palette', role: 'dialog', 'aria-label': 'Command palette', 'aria-modal': 'true' });
    palette.innerHTML =
      '<div class="palette-input-wrap"><svg class="ic" aria-hidden="true"><use href="#ic-cmd"></use></svg>' +
        '<input class="palette-input" id="cp-input" placeholder="Type a command or search..." autocomplete="off">' +
        '<span class="small muted"><kbd>Esc</kbd></span></div>' +
      '<div class="palette-list" id="cp-list"></div>';
    overlay.appendChild(palette);
    root.appendChild(overlay);

    var input = U.$('#cp-input', palette);
    var listEl = U.$('#cp-list', palette);
    var items = [];
    var activeIdx = 0;

    function build(q) {
      var lq = q.toLowerCase();
      var out = [];
      function add(title, icon, fn, show) {
        if (typeof show === 'function' && !show()) return;
        if (!lq || title.toLowerCase().indexOf(lq) >= 0) out.push({ title: title, icon: icon, fn: fn });
      }
      var user = MTA.state.currentUser;
      var allowed = MTA.permissions.allowedIds(user);
      add('Open dashboard', 'ic-dashboard', function () { window.location.hash = '#/dashboard'; });
      add('Open projects', 'ic-folder', function () { window.location.hash = '#/projects'; }, function () { return allowed.indexOf('projects') >= 0; });
      add('Open DevNote', 'ic-note', function () { window.location.hash = '#/devnote'; }, function () { return allowed.indexOf('devnote') >= 0; });
      add('Open tasks', 'ic-tasks', function () { window.location.hash = '#/tasks'; }, function () { return allowed.indexOf('tasks') >= 0; });
      add('Open activity', 'ic-activity', function () { window.location.hash = '#/activity'; }, function () { return allowed.indexOf('activity') >= 0; });
      add('Open calendar', 'ic-calendar', function () { window.location.hash = '#/calendar'; }, function () { return allowed.indexOf('calendar') >= 0; });
      add('Open settings', 'ic-settings', function () { window.location.hash = '#/settings'; });
      add('Toggle theme', 'ic-palette', function () { MTA.state.toggleTheme(); APP.renderHeader(); });
      add('Lock session', 'ic-lock', function () { MTA.auth.lock(); });
      add('Sign out', 'ic-logout', function () { MTA.auth.logout(); APP.showAuth(null); });
      add('New project', 'ic-plus', function () { window.location.hash = '#/projects'; setTimeout(function () { var b = document.querySelector('#pj-new'); if (b) b.click(); }, 80); }, function () { return allowed.indexOf('projects') >= 0; });
      add('New task', 'ic-plus', function () { window.location.hash = '#/tasks'; setTimeout(function () { var b = document.querySelector('#tk-new'); if (b) b.click(); }, 80); }, function () { return allowed.indexOf('tasks') >= 0; });
      add('New note', 'ic-plus', function () { window.location.hash = '#/devnote'; }, function () { return allowed.indexOf('devnote') >= 0; });
      add('New event', 'ic-plus', function () { window.location.hash = '#/calendar'; }, function () { return allowed.indexOf('calendar') >= 0; });
      add('Export backup', 'ic-download', function () {
        MTA.utils.download('mta-devdashboard-backup-' + MTA.utils.todayStr() + '.json', JSON.stringify(MTA.store.exportAll(), null, 2), 'application/json');
        MTA.toast('Backup exported', 'success');
      });
      return out;
    }

    function render() {
      items = build(input.value.trim());
      activeIdx = 0;
      if (!items.length) {
        listEl.innerHTML = '<div class="palette-empty">No matching commands</div>';
        return;
      }
      listEl.innerHTML = items.map(function (it, i) {
        return '<button class="palette-item' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '">' +
          '<span class="p-ic">' + U.icon(it.icon) + '</span><span class="p-title">' + U.esc(it.title) + '</span></button>';
      }).join('');
      listEl.querySelectorAll('[data-idx]').forEach(function (b) {
        b.addEventListener('click', function () { items[+b.dataset.idx].fn(); APP.closeSearch(); });
      });
    }
    render();
    input.addEventListener('input', render);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(items.length - 1, activeIdx + 1); refreshCp(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(0, activeIdx - 1); refreshCp(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (items[activeIdx]) { items[activeIdx].fn(); APP.closeSearch(); } }
      else if (e.key === 'Escape') { e.preventDefault(); APP.closeSearch(); }
    });
    function refreshCp() {
      listEl.querySelectorAll('[data-idx]').forEach(function (b) { b.classList.toggle('active', +b.dataset.idx === activeIdx); });
      var a = listEl.querySelector('[data-idx="' + activeIdx + '"]');
      if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest' });
    }
    input.focus();
  };

  /* ============================================================
     DEEP LINKS (projects/:id, devnote/:id)
     ============================================================ */
  function handleDeepLink(page, id) {
    if (!id) return;
    try { id = decodeURIComponent(id); } catch (e) { /* ignore */ }
    if (page === 'projects') {
      var p = MTA.projects.get(id);
      if (p && MTA.projects._openDetails) MTA.projects._openDetails(id);
    } else if (page === 'devnote') {
      var n = MTA.devnote.get(id);
      if (n) {
        var mainEl = document.getElementById('app-main');
        if (MTA.devnote._open) MTA.devnote._open(id);
        else { MTA.devnote.render(mainEl); MTA.devnote._open(id); }
      }
    }
  }

  /* ============================================================
     BOOT
     ============================================================ */
  APP.resumeApp = function () {
    /* called after unlock with existing session */
    if (!MTA.state.currentUser) return;
    boot();
  };

  APP.bootApp = function () {
    /* called after fresh sign-in */
    if (!MTA.state.currentUser) return;
    boot();
  };

  function boot() {
    shell = shell || document.getElementById('shell');
    main = main || document.getElementById('app-main');
    authView = authView || document.getElementById('auth-view');

    authView.hidden = true;
    shell.hidden = false;

    APP.applySidebarPref();
    APP.renderHeader();
    APP.renderSidebar();
    startClock();
    initNetwork();
    APP.bindShortcuts();

    /* route to first allowed page */
    MTA.state.emit('boot');
    if (!location.hash || location.hash === '#/') location.hash = '#/dashboard';
    MTA.router.init();

    /* start idle lock timer */
    startIdleLock();

    /* listen for route navigations to apply deep links */
    if (!APP._routeBound) {
      APP._routeBound = true;
      MTA.state.on('route', function (page) {
        var parsed = MTA.router && MTA.router._lastParsed;
        if (parsed && parsed.id) handleDeepLink(page, parsed.id);
      });
    }
  }

  APP.applySidebarPref = function () {
    var a = MTA.state.settings && MTA.state.settings.appearance;
    var collapsed = a && a.sidebar === 'collapsed';
    document.documentElement.classList.toggle('sb-collapsed', collapsed);
  };

  APP.scrollMainTop = function () {
    main = main || document.getElementById('app-main');
    if (main) main.scrollTop = 0;
  };

  /* ---------- Idle lock ---------- */
  var idleTimer = null;
  function startIdleLock() {
    var sec = MTA.state.settings && MTA.state.settings.security
      ? (MTA.state.settings.security.idleTimeout || 0) : 0;
    clearInterval(idleTimer);
    if (!sec) return;
    function arm() {
      idleTimer = setInterval(function () {
        if (!MTA.state.locked && !authView.hidden) MTA.auth.lock();
      }, sec * 60000);
    }
    /* reset timer on user activity */
    var reset = function () { clearInterval(idleTimer); arm(); };
    ['click', 'keydown', 'mousemove', 'scroll'].forEach(function (ev) {
      document.addEventListener(ev, reset, { passive: true });
    });
    arm();
  }

  /* sidebar backdrop close on mobile */
  document.addEventListener('click', function (e) {
    if (e.target.closest('.sidebar-backdrop')) {
      document.documentElement.classList.remove('sb-open');
    }
  });

  /* expose the pre-router hook */
  APP.handleDeepLink = handleDeepLink;

  /* ============================================================
     INIT (entry point)
     ============================================================ */
  APP.init = function () {
    try {
      MTA.store.ensureInit();
    } catch (e) {
      console.error('storage init failed', e);
      try { MTA.store.resetApplication(); MTA.store.ensureInit(); } catch (e2) { /* ignore */ }
    }

    MTA.state.loadSettings();

    /* corruption warnings */
    if (MTA.store.corruptionWarnings && MTA.store.corruptionWarnings.length) {
      var warned = MTA.store.corruptionWarnings;
      setTimeout(function () {
        MTA.toast('Some stored data was corrupted and re-initialized.', 'warn');
      }, 600);
    }

    /* repair records missing lastLogin field */
    var users = MTA.store.users();
    var dirty = false;
    users.forEach(function (u) {
      if (u.lastLogin === undefined) { u.lastLogin = null; dirty = true; }
      if (!u.permissions) { u.permissions = []; dirty = true; }
    });
    if (dirty) MTA.store.saveUsers(users);

    var hasSession = MTA.auth.resume();

    if (hasSession && !MTA.state.locked) {
      setTimeout(function () {
        boot();
        APP.renderHeader();
      }, 0);
    } else if (hasSession && MTA.state.locked) {
      APP.showAuth('lock');
    } else {
      APP.showAuth(null);
    }
  };

  /* run when DOM is ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', APP.init);
  } else {
    APP.init();
  }
})(typeof window !== 'undefined' ? window : this);