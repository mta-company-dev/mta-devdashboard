/* ============================================================
   MTA DevDashboard — storage.js
   Centralized localStorage layer. Handles missing/corrupted
   data, validation, versioning, export/import.
   ============================================================ */
(function (global) {
  'use strict';
  var MTA = (global.MTA = global.MTA || {});
  var U = MTA.utils;
  var S = {};

  var KEYS = {
    meta: 'mta_meta',
    users: 'mta_users',
    session: 'mta_session',
    projects: 'mta_projects',
    notes: 'mta_notes',
    tasks: 'mta_tasks',
    events: 'mta_events',
    activity: 'mta_activity',
    settings: 'mta_settings',
    theme: 'mta_theme'
  };

  var VERSION = 1;
  var ACTIVITY_CAP = 2500;

  S.KEYS = KEYS;
  S.VERSION = VERSION;
  S.corruptionWarnings = [];

  /* ---------- Default settings ---------- */
  S.defaultSettings = function () {
    return {
      profile: { displayName: '', username: '', avatar: null, avatarColor: 0 },
      appearance: {
        theme: 'ivory', fontSize: 16, uiScale: 1, animations: true,
        reducedMotion: false, sidebar: 'expanded'
      },
      dashboard: {
        widgets: {
          stats: true, charts: true, activity: true, projects: true,
          tasks: true, events: true, active: true, quick: true
        }
      },
      projects: { sort: 'updated_desc', view: 'grid', category: 'All' },
      tasks: { priority: 'Medium', view: 'list' },
      devnote: { autosave: 5, fontSize: 14 },
      calendar: { startDay: 1, dateFormat: 'YYYY-MM-DD', timeFormat: '24h', defaultDuration: 60 },
      notifications: { toastDuration: 3500 },
      shortcuts: {
        'global-search': 'ctrl+k',
        'new-item': 'ctrl+n',
        'save': 'ctrl+s',
        'command-palette': 'ctrl+shift+p',
        'dashboard': 'ctrl+1',
        'projects': 'ctrl+2',
        'devnote': 'ctrl+3',
        'tasks': 'ctrl+4',
        'activity': 'ctrl+5',
        'calendar': 'ctrl+6',
        'settings': 'ctrl+,'
      },
      security: { idleTimeout: 30 }
    };
  };

  /* ---------- Safe get / set ---------- */
  S.get = function (key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      var v = JSON.parse(raw);
      if (Array.isArray(fallback) && !Array.isArray(v)) {
        S.corruptionWarnings.push(key);
        localStorage.removeItem(key);
        return fallback;
      }
      return v;
    } catch (err) {
      S.corruptionWarnings.push(key);
      try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
      return fallback;
    }
  };

  S.set = function (key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      if (typeof MTA.toast === 'function') {
        MTA.toast('Could not save — browser storage is full or blocked.', 'error');
      }
      return false;
    }
  };

  S.remove = function (key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  };

  /* ============================================================
     Collections
     ============================================================ */
  S.users = function () { return S.get(KEYS.users, []); };
  S.saveUsers = function (list) { return S.set(KEYS.users, list); };

  S.projects = function () { return S.get(KEYS.projects, []); };
  S.saveProjects = function (list) { return S.set(KEYS.projects, list); };

  S.notes = function () { return S.get(KEYS.notes, []); };
  S.saveNotes = function (list) { return S.set(KEYS.notes, list); };

  S.tasks = function () { return S.get(KEYS.tasks, []); };
  S.saveTasks = function (list) { return S.set(KEYS.tasks, list); };

  S.events = function () { return S.get(KEYS.events, []); };
  S.saveEvents = function (list) { return S.set(KEYS.events, list); };

  S.activity = function () { return S.get(KEYS.activity, []); };
  S.saveActivity = function (list) {
    if (list.length > ACTIVITY_CAP) list = list.slice(list.length - ACTIVITY_CAP);
    return S.set(KEYS.activity, list);
  };

  S.session = function () { return S.get(KEYS.session, null); };
  S.saveSession = function (obj) {
    if (obj == null) { S.remove(KEYS.session); return true; }
    return S.set(KEYS.session, obj);
  };

  S.settings = function () { return S.get(KEYS.settings, S.defaultSettings()); };
  S.saveSettings = function (obj) { return S.set(KEYS.settings, obj); };

  S.theme = function () {
    var t = S.get(KEYS.theme, null);
    return t === 'charcoal' || t === 'ivory' ? t : 'ivory';
  };
  S.saveTheme = function (t) { return S.set(KEYS.theme, t); };

  S.meta = function () { return S.get(KEYS.meta, null); };

  /* ============================================================
     Seeding (first run only)
     ============================================================ */
  function daysAgo(n, hour, min) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    if (hour != null) d.setHours(hour, min || 0, 0, 0);
    else d.setHours(9 + (n % 8), (n * 13) % 60, 0, 0);
    return d;
  }
  function iso(d) { return d.toISOString(); }
  function dayStr(n) {
    var d = daysAgo(n);
    return U.dateStr(d);
  }

  S.seed = function () {
    var now = new Date();
    var adminId = 'usr_admin1';
    var users = [{
      id: adminId,
      username: 'admin',
      displayName: 'Super Admin',
      password: U.hashPassword('admin123'),
      role: 'super_admin',
      status: 'active',
      permissions: ['dashboard', 'projects', 'devnote', 'tasks', 'activity', 'calendar', 'admins', 'settings'],
      avatar: null,
      avatarColor: 0,
      createdAt: iso(daysAgo(120)),
      lastLogin: null
    }];

    /* ---- Projects ---- */
    var projects = [
      {
        id: 'prj_1', name: 'MTA DevDashboard', description: 'Internal developer command center — the app you are using right now.',
        category: 'Web App', tags: ['dashboard', 'javascript', 'local-first'], status: 'Development',
        priority: 'High', progress: 62, startDate: dayStr(64), deadline: dayStr(24),
        repoUrl: 'https://github.com/mta/devdashboard', liveUrl: 'https://dashboard.mta.app',
        localPath: 'E:/Projects/mta-devdashboard', notes: 'Glass UI, localStorage persistence. Charts module still in review.',
        favorite: true, createdAt: iso(daysAgo(64)), updatedAt: iso(daysAgo(1))
      },
      {
        id: 'prj_2', name: 'REST API Gateway', description: 'Unified gateway for internal microservices with auth + rate limiting.',
        category: 'Back-end', tags: ['node', 'api', 'gateway'], status: 'Testing',
        priority: 'High', progress: 81, startDate: dayStr(80), deadline: dayStr(10),
        repoUrl: 'https://github.com/mta/gateway', liveUrl: '', localPath: 'E:/Projects/api-gateway',
        notes: 'Load tests passed 12k rps.', favorite: false,
        createdAt: iso(daysAgo(80)), updatedAt: iso(daysAgo(2))
      },
      {
        id: 'prj_3', name: 'Mobile Companion App', description: 'Companion app for field engineers. Offline-first sync.',
        category: 'Mobile', tags: ['react-native', 'offline'], status: 'Planning',
        priority: 'Medium', progress: 12, startDate: dayStr(30), deadline: dayStr(60),
        repoUrl: 'https://github.com/mta/mobile-app', liveUrl: '', localPath: 'E:/Projects/mobile-app',
        notes: 'Design tokens finalized. Awaiting API contracts.', favorite: false,
        createdAt: iso(daysAgo(30)), updatedAt: iso(daysAgo(4))
      },
      {
        id: 'prj_4', name: 'Marketing Site Redesign', description: 'Company site refresh — SSG, SEO, analytics.',
        category: 'Web Site', tags: ['eleventy', 'seo'], status: 'Archived',
        priority: 'Low', progress: 100, startDate: dayStr(150), deadline: dayStr(70),
        repoUrl: 'https://github.com/mta/site', liveUrl: 'https://mta.app', localPath: 'E:/Projects/site',
        notes: 'Shipped in March. Archived.', favorite: false,
        createdAt: iso(daysAgo(150)), updatedAt: iso(daysAgo(70))
      },
      {
        id: 'prj_5', name: 'CI/CD Pipeline', description: 'Automated build, test and deploy for all repos.',
        category: 'DevOps', tags: ['github-actions', 'docker'], status: 'Testing',
        priority: 'High', progress: 75, startDate: dayStr(45), deadline: dayStr(15),
        repoUrl: 'https://github.com/mta/pipeline', liveUrl: '', localPath: 'E:/Projects/pipeline',
        notes: 'Matrix builds enabled.', favorite: true,
        createdAt: iso(daysAgo(45)), updatedAt: iso(daysAgo(3))
      },
      {
        id: 'prj_6', name: 'Internal Tools Hub', description: 'Single entry point for internal tools and docs.',
        category: 'Internal Tool', tags: ['portal', 'docs'], status: 'Deployed',
        priority: 'Medium', progress: 100, startDate: dayStr(120), deadline: dayStr(40),
        repoUrl: 'https://github.com/mta/tools-hub', liveUrl: '', localPath: 'E:/Projects/tools-hub',
        notes: 'Live for the whole company.', favorite: false,
        createdAt: iso(daysAgo(120)), updatedAt: iso(daysAgo(20))
      }
    ];

    /* ---- Tasks ---- */
    var tasks = [
      { id: 'tsk_1', title: 'Chart toolkit: line and bar renderers', description: 'Canvas renderers with hover tooltips.', projectId: 'prj_1', priority: 'High', status: 'In Progress', dueDate: dayStr(-3), tags: ['charts'], createdAt: iso(daysAgo(9)), completedAt: null },
      { id: 'tsk_2', title: 'Shortcut conflict detection', description: 'Warn when two actions share a combo.', projectId: 'prj_1', priority: 'Medium', status: 'Todo', dueDate: dayStr(4), tags: ['settings'], createdAt: iso(daysAgo(5)), completedAt: null },
      { id: 'tsk_3', title: 'Add OpenTelemetry tracing', description: 'Inject tracing context through middleware.', projectId: 'prj_2', priority: 'Critical', status: 'In Progress', dueDate: dayStr(-1), tags: ['otel'], createdAt: iso(daysAgo(12)), completedAt: null },
      { id: 'tsk_4', title: 'Rate limiter token bucket', description: 'Per-key token bucket.', projectId: 'prj_2', priority: 'High', status: 'Review', dueDate: dayStr(2), tags: ['api'], createdAt: iso(daysAgo(14)), completedAt: null },
      { id: 'tsk_5', title: 'Offline sync queue', description: 'Queue events when offline.', projectId: 'prj_3', priority: 'Medium', status: 'Todo', dueDate: dayStr(12), tags: ['offline'], createdAt: iso(daysAgo(3)), completedAt: null },
      { id: 'tsk_6', title: 'Deploy to staging', description: 'Ship alpha build to staging env.', projectId: 'prj_5', priority: 'High', status: 'Review', dueDate: dayStr(1), tags: ['deploy'], createdAt: iso(daysAgo(6)), completedAt: null },
      { id: 'tsk_7', title: 'Write migration script', description: 'Versioned data migrations.', projectId: 'prj_6', priority: 'Low', status: 'Done', dueDate: dayStr(-8), tags: ['devops'], createdAt: iso(daysAgo(20)), completedAt: iso(daysAgo(8)) },
      { id: 'tsk_8', title: 'Update sensor dashboard charts', description: 'Refresh metrics cards.', projectId: 'prj_6', priority: 'Medium', status: 'Done', dueDate: dayStr(-6), tags: ['dashboard'], createdAt: iso(daysAgo(15)), completedAt: iso(daysAgo(6)) },
      { id: 'tsk_9', title: 'SEO audit pass', description: 'Metadata and alt text.', projectId: 'prj_4', priority: 'Low', status: 'Done', dueDate: dayStr(-20), tags: ['seo'], createdAt: iso(daysAgo(30)), completedAt: iso(daysAgo(20)) },
      { id: 'tsk_10', title: 'Review pull request: editor toolbar', description: 'Check formatting commands.', projectId: 'prj_1', priority: 'Medium', status: 'Done', dueDate: dayStr(-2), tags: ['review'], createdAt: iso(daysAgo(7)), completedAt: iso(daysAgo(2)) }
    ];

    /* ---- Notes ---- */
    var notes = [
      { id: 'nt_1', title: 'Deployment runbook', subtitle: 'Checklist for safe shipping', category: 'DevOps', tags: ['deploy', 'runbook'], content: '<h2>Pre-flight</h2><ul><li>Confirm CI is green</li><li>Backup the database</li></ul><blockquote>Never deploy on a Friday.</blockquote>', pinned: true, favorite: true, createdAt: iso(daysAgo(40)), updatedAt: iso(daysAgo(1)) },
      { id: 'nt_2', title: 'Chart color palette', subtitle: 'Accessible pairings for canvas', category: 'Design', tags: ['charts', 'a11y'], content: '<p>Sage green works on ivory and charcoal.</p><p>Keep labels at 10.5px minimum.</p>', pinned: false, favorite: true, createdAt: iso(daysAgo(12)), updatedAt: iso(daysAgo(6)) },
      { id: 'nt_3', title: 'API conventions', subtitle: 'REST style guide', category: 'Back-end', tags: ['api'], content: '<h3>Naming</h3><pre><code>GET /v1/projects/:id</code></pre><p>Use kebab-case collection names.</p>', pinned: false, favorite: false, createdAt: iso(daysAgo(55)), updatedAt: iso(daysAgo(10)) },
      { id: 'nt_4', title: 'Meeting notes', subtitle: 'Q3 goals', category: 'General', tags: ['meetings'], content: '<p>Discuss Q3 priorities and MVP scope for the mobile app.</p>', pinned: false, favorite: false, createdAt: iso(daysAgo(18)), updatedAt: iso(daysAgo(3)) },
      { id: 'nt_5', title: 'localStorage notes', subtitle: 'About 5MB per origin.', category: 'Research', tags: ['storage'], content: '<p>Store JSON. Compact indexes. Watch the 5MB quota.</p>', pinned: false, favorite: false, createdAt: iso(daysAgo(7)), updatedAt: iso(daysAgo(7)) }
    ];

    /* ---- Calendar events ---- */
    function ev(id, title, dayOff, startHour, endHour, color, desc) {
      var sd = daysAgo(dayOff);
      sd.setHours(startHour, 0, 0, 0);
      var ed = new Date(sd.getTime());
      ed.setHours(endHour, 0, 0, 0);
      return {
        id: id, title: title, description: desc || '', allDay: false,
        start: sd.toISOString(), end: ed.toISOString(),
        color: color || 1, createdAt: iso(daysAgo(25)), updatedAt: iso(daysAgo(25))
      };
    }
    var events = [
      ev('ev_1', 'Standup', 1, 9, 10, 1, 'Daily team standup.'),
      ev('ev_2', 'Design review', 2, 14, 15, 2, 'Charts and palette review.'),
      ev('ev_3', 'Release planning', -2, 10, 11, 3, 'Plan next release scope.'),
      ev('ev_4', 'One on one with Mina', 4, 11, 12, 5, 'Career check-in.'),
      ev('ev_5', 'Infra maintenance', 6, 22, 23, 4, 'Scheduled downtime window.'),
      ev('ev_6', 'Architecture sync', -5, 13, 14, 2, 'Gateway providers discussion.'),
      { id: 'ev_7', title: 'Sprint demo', description: 'Show the tooling progress.', allDay: true, start: dayStr(8), end: dayStr(8), color: 2, createdAt: iso(daysAgo(20)), updatedAt: iso(daysAgo(20)) },
      ev('ev_8', 'Team lunch', -1, 12, 13, 6, 'Monthly team lunch.')
    ];

    /* ---- Activity log (derived from the seeded operations) ---- */
    var activity = [];
    function track(type, action, userId, ts, extra) {
      activity.push(Object.assign({
        id: U.uid('act'),
        type: type,
        action: action,
        userId: userId || adminId,
        timestamp: ts || new Date().toISOString()
      }, extra || {}));
    }
    track('login', 'Signed in to the dashboard', adminId, iso(daysAgo(30)));
    track('settings', 'Installed sample workspace', adminId, iso(daysAgo(30)));

    projects.forEach(function (p) {
      track('project_create', 'Created project ' + p.name, adminId, p.createdAt, { entityType: 'project', entityId: p.id });
      track('project_edit', 'Edited project ' + p.name, adminId, p.updatedAt, { entityType: 'project', entityId: p.id });
    });
    tasks.forEach(function (t) {
      var pname = (projects.find(function (x) { return x.id === t.projectId; }) || {}).name || 'Project';
      track('task_create', 'Created task ' + t.title, adminId, t.createdAt, { entityType: 'task', entityId: t.id, project: pname });
      if (t.completedAt) {
        track('task_complete', 'Completed task ' + t.title, adminId, t.completedAt, { entityType: 'task', entityId: t.id, project: pname });
      }
    });
    notes.forEach(function (x) {
      track('note_create', 'Created note ' + x.title, adminId, x.createdAt, { entityType: 'note', entityId: x.id });
      track('note_edit', 'Edited note ' + x.title, adminId, x.updatedAt, { entityType: 'note', entityId: x.id });
    });
    events.forEach(function (x) {
      track('event_create', 'Created event ' + x.title, adminId, x.createdAt, { entityType: 'event', entityId: x.id });
    });
    ['dashboard', 'projects', 'devnote', 'tasks', 'calendar', 'activity'].forEach(function (pg, i) {
      track('navigation', 'Opened ' + pg + ' section', adminId, iso(daysAgo(28 - i * 4)), { page: pg });
    });

    activity.sort(function (a, b) { return a.timestamp < b.timestamp ? 1 : -1; });

    /* ---- Save seed & summary ---- */
    var settings = S.defaultSettings();
    settings.profile.displayName = 'Super Admin';
    settings.profile.username = 'admin';

    S.saveUsers(users);
    S.saveProjects(projects);
    S.saveTasks(tasks);
    S.saveNotes(notes);
    S.saveEvents(events);
    S.saveActivity(activity);
    S.saveSettings(settings);
    S.saveTheme('ivory');
    S.set(KEYS.meta, { v: VERSION, app: 'mta-devdashboard', seededAt: now.toISOString() });
  };

  /* ---------- Init / migration ---------- */
  S.ensureInit = function () {
    var meta = S.meta();
    if (!meta || !meta.v) {
      S.seed();
      return { seeded: true };
    }
    /* Ensure collections that vanished still have a default admin. */
    if (meta.v < VERSION) {
      meta.v = VERSION;
      S.set(KEYS.meta, meta);
    }
    var users = S.users();
    if (!users.length) {
      S.saveUsers([{
        id: 'usr_admin1',
        username: 'admin',
        displayName: 'Super Admin',
        password: U.hashPassword('admin123'),
        role: 'super_admin',
        status: 'active',
        permissions: ['dashboard', 'projects', 'devnote', 'tasks', 'activity', 'calendar', 'admins', 'settings'],
        avatar: null,
        avatarColor: 0,
        createdAt: new Date().toISOString(),
        lastLogin: null
      }]);
    }
    var st = S.settings();
    if (!st || !st.appearance) S.saveSettings(S.defaultSettings());
    if (!S.theme()) S.saveTheme('ivory');
    return { seeded: false };
  };

  /* ---------- Export / Import ---------- */
  S.exportAll = function () {
    return {
      app: 'mta-devdashboard',
      version: VERSION,
      exportedAt: new Date().toISOString(),
      users: S.users(),
      projects: S.projects(),
      notes: S.notes(),
      tasks: S.tasks(),
      events: S.events(),
      activity: S.activity(),
      settings: S.settings(),
      theme: S.theme()
    };
  };

  /* Validate an imported object; returns {ok, errors}. */
  S.validateImport = function (obj) {
    var errors = [];
    if (!obj || typeof obj !== 'object') errors.push('Not an object.');
    if (obj && obj.app !== 'mta-devdashboard') errors.push('Not an MTA DevDashboard backup.');
    if (obj && !Array.isArray(obj.users)) errors.push('users must be an array.');
    if (obj && !Array.isArray(obj.projects)) errors.push('projects must be an array.');
    if (obj && !Array.isArray(obj.notes)) errors.push('notes must be an array.');
    if (obj && !Array.isArray(obj.tasks)) errors.push('tasks must be an array.');
    if (obj && !Array.isArray(obj.events)) errors.push('events must be an array.');
    if (obj && !Array.isArray(obj.activity)) errors.push('activity must be an array.');
    return { ok: !errors.length, errors: errors };
  };

  S.importAll = function (obj) {
    var v = S.validateImport(obj);
    if (!v.ok) return v;
    S.saveUsers(obj.users);
    S.saveProjects(obj.projects);
    S.saveNotes(obj.notes);
    S.saveTasks(obj.tasks);
    S.saveEvents(obj.events);
    S.saveActivity(obj.activity);
    S.saveSettings(obj.settings || S.defaultSettings());
    S.saveTheme(obj.theme === 'charcoal' || obj.theme === 'ivory' ? obj.theme : 'ivory');
    S.set(KEYS.meta, { v: VERSION, app: 'mta-devdashboard', importedAt: new Date().toISOString() });
    S.remove(KEYS.session);
    return { ok: true };
  };

  /* ---------- Clearing ---------- */
  S.clearSelected = function (targets) {
    if (targets.indexOf('admins') >= 0) {
      var users = S.users().filter(function (u) { return u.role === 'super_admin'; });
      S.saveUsers(users.length ? users : []);
    }
    if (targets.indexOf('projects') >= 0) S.saveProjects([]);
    if (targets.indexOf('notes') >= 0) S.saveNotes([]);
    if (targets.indexOf('tasks') >= 0) S.saveTasks([]);
    if (targets.indexOf('events') >= 0) S.saveEvents([]);
    if (targets.indexOf('activity') >= 0) S.saveActivity([]);
    if (targets.indexOf('settings') >= 0) S.saveSettings(S.defaultSettings());
  };

  S.clearAll = function () {
    Object.keys(KEYS).forEach(function (k) { S.remove(KEYS[k]); });
  };

  S.resetApplication = function () {
    S.clearAll();
    S.seed();
  };

  /* ---------- Diagnostics ---------- */
  S.usage = function () {
    var total = 0;
    var items = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('mta_') === 0) {
          var len = (localStorage.getItem(k) || '').length;
          items[k] = len;
          total += len;
        }
      }
    } catch (e) { /* ignore */ }
    return { bytes: total, items: items, estimatedQuota: 5242880 };
  };

  MTA.store = S;
})(typeof window !== 'undefined' ? window : this);