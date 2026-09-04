/* ============================================================
   MTA DevDashboard - modules/dashboard.js
   Developer command center. All charts use real local data.
   ============================================================ */
(function (global) {
  'use strict';
  var MTA = (global.MTA = global.MTA || {});
  var U = MTA.utils;
  var DB = {};

  /* ---------- Aggregation helpers ---------- */
  function byDayCount(n) {
    var map = {};
    var now = U.startOfDay(new Date());
    for (var i = n - 1; i >= 0; i--) {
      map[U.dateStr(U.addDays(now, -i))] = 0;
    }
    MTA.store.activity().forEach(function (a) {
      var d = U.toDate(a.timestamp);
      var key = d ? U.dateStr(d) : null;
      if (key && map[key] != null) map[key]++;
    });
    var labels = Object.keys(map).map(function (k) { return k.slice(5); });
    return { labels: labels, values: Object.keys(map).map(function (k) { return map[k]; }) };
  }

  function tasksCompletedByDay(n) {
    var map = {};
    var now = U.startOfDay(new Date());
    for (var i = n - 1; i >= 0; i--) {
      map[U.dateStr(U.addDays(now, -i))] = 0;
    }
    MTA.store.tasks().forEach(function (t) {
      if (!t.completedAt || t.status !== 'Done') return;
      var d = U.toDate(t.completedAt);
      var key = d ? U.dateStr(d) : null;
      if (key && map[key] != null) map[key]++;
    });
    var labels = Object.keys(map).map(function (k) { return k.slice(5); });
    return { labels: labels, values: Object.keys(map).map(function (k) { return map[k]; }) };
  }

  function projectsByStatus() {
    var map = { Planning: 0, Development: 0, Testing: 0, Deployed: 0, Archived: 0 };
    MTA.store.projects().forEach(function (p) {
      if (map[p.status] != null) map[p.status]++;
    });
    return map;
  }

  /* Productivity trend: activity per day, lightly smoothed. */
  function productivityTrend(n) {
    var raw = byDayCount(n).values;
    var out = raw.map(function (v, i) {
      var start = Math.max(0, i - 2);
      var end = Math.min(raw.length, i + 3);
      var sum = 0;
      for (var j = start; j < end; j++) sum += raw[j];
      return Math.round((sum / (end - start)) * 10) / 10;
    });
    return { labels: byDayCount(n).labels, values: out };
  }

  function activityByCategory() {
    var map = {};
    MTA.store.activity().forEach(function (a) {
      var cat = a.type || 'other';
      map[cat] = (map[cat] || 0) + 1;
    });
    var sorted = Object.keys(map).sort(function (x, y) { return map[y] - map[x]; }).slice(0, 6);
    return { labels: sorted, values: sorted.map(function (k) { return map[k]; }) };
  }

  function mostActiveProject() {
    var map = {};
    MTA.store.activity().forEach(function (a) {
      var proj = a.project;
      if (!proj && a.extra && a.extra.project) proj = a.extra.project;
      if (!proj) return;
      map[proj] = (map[proj] || 0) + 1;
    });
    var best = null;
    Object.keys(map).forEach(function (k) {
      if (!best || map[k] > best.count) best = { name: k, count: map[k] };
    });
    return best || { name: '—', count: 0 };
  }

  /* ---------- Stat compute ---------- */
  function computeStats() {
    var projects = MTA.store.projects();
    var tasks = MTA.store.tasks();
    var active = projects.filter(function (p) {
      return p.status !== 'Archived' && p.status !== 'Deployed';
    }).length;
    var open = tasks.filter(function (t) { return t.status !== 'Done'; }).length;
    var done = tasks.filter(function (t) { return t.status === 'Done'; }).length;

    var totalMs = 0;
    MTA.store.activity().forEach(function (a) {
      if (a.type !== 'login' && a.type !== 'logout') totalMs += 15 * 60000;
    });

    return {
      totalProjects: projects.length,
      activeProjects: active,
      openTasks: open,
      completedTasks: done,
      devNotes: MTA.store.notes().length,
      activityTime: totalMs
    };
  }

  /* ---------- Render ---------- */
  DB.render = function (main) {
    var P = MTA.projects, stats = computeStats();
    var widgets = (MTA.state.settings && MTA.state.settings.dashboard)
      ? MTA.state.settings.dashboard.widgets : null;
    function w(name) { return !widgets || widgets[name] !== false; }

    var hours = Math.floor(stats.activityTime / 3600000);
    var mins = Math.round((stats.activityTime % 3600000) / 60000);

    var statHtml = w('stats') ? (
      '<div class="stats-grid">' +
        '<div class="card stat-card"><div class="stat-icon">' + U.icon('ic-folder') + '</div><div><div class="stat-value">' + stats.totalProjects + '</div><div class="stat-label">Total projects</div></div></div>' +
        '<div class="card stat-card"><div class="stat-icon st-success">' + U.icon('ic-zap') + '</div><div><div class="stat-value">' + stats.activeProjects + '</div><div class="stat-label">Active projects</div></div></div>' +
        '<div class="card stat-card"><div class="stat-icon st-info">' + U.icon('ic-tasks') + '</div><div><div class="stat-value">' + stats.openTasks + '</div><div class="stat-label">Open tasks</div></div></div>' +
        '<div class="card stat-card"><div class="stat-icon st-warn">' + U.icon('ic-checkc') + '</div><div><div class="stat-value">' + stats.completedTasks + '</div><div class="stat-label">Completed tasks</div></div></div>' +
        '<div class="card stat-card"><div class="stat-icon st-danger">' + U.icon('ic-note') + '</div><div><div class="stat-value">' + stats.devNotes + '</div><div class="stat-label">DevNotes</div></div></div>' +
        '<div class="card stat-card"><div class="stat-icon st-success">' + U.icon('ic-clock') + '</div><div><div class="stat-value">' + hours + 'h <span class="small muted">' + mins + 'm</span></div><div class="stat-label">Activity time</div></div></div>' +
      '</div>'
    ) : '';

    /* upcoming tasks */
    var today = U.todayStr();
    var upcoming = MTA.store.tasks().filter(function (t) {
      return t.status !== 'Done' && t.dueDate && t.dueDate >= today;
    }).sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : 1; }).slice(0, 5);

    var upcomingHtml = w('tasks') ? (
      '<div class="card"><div class="card-head"><h3>Upcoming tasks</h3>' +
      '<a href="#/tasks" class="small">View all</a></div><div>' +
      (upcoming.length
        ? upcoming.map(function (t) {
          var dl = U.deadlineLabel(t.dueDate);
          var pn = (P.get(t.projectId) || {}).name || 'No project';
          return '<div class="widget-item"><span class="wi-ic">' + U.icon('ic-tasks') + '</span>' +
            '<span class="wi-body"><span class="wi-title ellipsis">' + U.esc(t.title) + '</span>' +
            '<span class="wi-sub">' + U.esc(pn) + '</span></span>' +
            '<span class="task-due ' + dl.cls + '">' + dl.text + '</span></div>';
        }).join('')
        : '<div class="empty" style="min-height:110px"><div class="empty-ic">' + U.icon('ic-tasks') + '</div><h3>All clear</h3><p>No upcoming task deadlines.</p></div>') +
      '</div></div>'
    ) : '';

    /* recent projects */
    var recentProjs = MTA.store.projects().slice().sort(function (a, b) {
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    }).slice(0, 5);
    var recentProjHtml = w('projects') ? (
      '<div class="card"><div class="card-head"><h3>Recent projects</h3>' +
      '<a href="#/projects" class="small">View all</a></div><div>' +
      (recentProjs.length
        ? recentProjs.map(function (p) {
          return '<div class="widget-item"><span class="wi-ic">' + U.icon('ic-folder') + '</span>' +
            '<span class="wi-body"><span class="wi-title ellipsis">' + U.esc(p.name) + '</span>' +
            '<span class="wi-sub">' + U.esc(p.status) + ' &middot; ' + U.timeAgo(p.updatedAt) + '</span></span>' +
            '<div class="progress" style="width:70px;flex:none"><span style="width:' + (+p.progress || 0) + '%"></span></div>' +
            '<span class="mono tiny">' + (+p.progress || 0) + '%</span></div>';
        }).join('')
        : '<div class="empty" style="min-height:110px"><div class="empty-ic">' + U.icon('ic-folder') + '</div><h3>No projects</h3><p>Projects you create will appear here.</p></div>') +
      '</div></div>'
    ) : '';

    /* recent activity */
    var recentAct = MTA.store.activity().slice().sort(function (a, b) {
      return (b.timestamp || '').localeCompare(a.timestamp || '');
    }).slice(0, 6);
    var actIcons = { login: 'ic-lock', project_create: 'ic-folder', project_edit: 'ic-edit', task_complete: 'ic-checkc', note_create: 'ic-note', event_create: 'ic-calendar', settings: 'ic-settings', navigation: 'ic-activity' };
    var recentActHtml = w('activity') ? (
      '<div class="card"><div class="card-head"><h3>Recent activity</h3>' +
      '<a href="#/activity" class="small">View all</a></div><div>' +
      (recentAct.length
        ? recentAct.map(function (a) {
          return '<div class="widget-item"><span class="wi-ic">' + U.icon(actIcons[a.type] || 'ic-activity') + '</span>' +
            '<span class="wi-body"><span class="wi-title ellipsis">' + U.esc(a.action || '') + '</span>' +
            '<span class="wi-sub">' + U.timeAgo(a.timestamp) + '</span></span>' +
            '<span class="wi-time">' + U.fmtTime(a.timestamp) + '</span></div>';
        }).join('')
        : '<div class="empty" style="min-height:110px"><div class="empty-ic">' + U.icon('ic-activity') + '</div><h3>No activity yet</h3></div>') +
      '</div></div>'
    ) : '';

    /* upcoming calendar events */
    var next3 = MTA.store.events().map(function (e) {
      var s = U.toDate(e.start);
      return { e: e, s: s ? s.getTime() : 0 };
    }).filter(function (o) { return o.s >= Date.now() - 3600000; })
      .sort(function (a, b) { return a.s - b.s; }).slice(0, 5);

    var evColors = ['ec-1', 'ec-2', 'ec-3', 'ec-4', 'ec-5', 'ec-6'];
    var calHtml = w('events') ? (
      '<div class="card"><div class="card-head"><h3>Upcoming events</h3>' +
      '<a href="#/calendar" class="small">View all</a></div><div>' +
      (next3.length
        ? next3.map(function (o) {
          var e = o.e;
          return '<div class="widget-item"><span class="cal-event ' + (evColors[(e.color || 1) - 1]) + '" style="width:auto;min-width:0">' +
            '<span class="ellipsis">' + U.esc(e.title) + '</span></span>' +
            '<span class="wi-body"><span class="wi-title ellipsis">' + U.fmtDate(e.start) + '</span>' +
            '<span class="wi-sub">' + (e.allDay ? 'All day' : U.fmtTime(e.start) + ' - ' + U.fmtTime(e.end)) + '</span></span></div>';
        }).join('')
        : '<div class="empty" style="min-height:110px"><div class="empty-ic">' + U.icon('ic-calendar') + '</div><h3>No upcoming events</h3></div>') +
      '</div></div>'
    ) : '';

    /* most active project */
    var active = mostActiveProject();
    var mostActivHtml = w('active') ? (
      '<div class="card"><div class="card-head"><h3>Most active project</h3></div><div class="card-body">' +
      '<div class="row" style="gap:var(--sp-3)"><span class="stat-icon">' + U.icon('ic-folder') + '</span>' +
      '<div><div class="stat-value" style="font-size:var(--fs-xl)">' + U.esc(active.name) + '</div>' +
      '<div class="stat-label">' + active.count + ' tracked actions</div></div></div></div></div>'
    ) : '';

    /* quick actions */
    var quickHtml = w('quick') ? (
      '<div class="card"><div class="card-head"><h3>Quick actions</h3></div>' +
      '<div class="card-body"><div class="quick-actions">' +
        '<a class="qa-btn" href="#/projects" data-new-project>' + U.icon('ic-plus') + ' New project</a>' +
        '<a class="qa-btn" href="#/devnote" data-new-note>' + U.icon('ic-note') + ' New note</a>' +
        '<a class="qa-btn" href="#/tasks" data-new-task>' + U.icon('ic-tasks') + ' New task</a>' +
        '<a class="qa-btn" href="#/calendar" data-new-event>' + U.icon('ic-calendar') + ' New event</a>' +
      '</div></div></div>'
    ) : '';

    /* charts */
    var charts = w('charts') ? (
      '<div class="dash-charts" style="margin-top:var(--sp-5)">' +
        '<div class="card chart-card"><div class="card-head"><h3>Activity over time</h3><span class="small muted">14 days</span></div>' +
          '<div class="chart-box"><canvas id="db-activity" role="img" aria-label="Activity line chart"></canvas></div></div>' +
        '<div class="card chart-card"><div class="card-head"><h3>Tasks completed</h3><span class="small muted">14 days</span></div>' +
          '<div class="chart-box"><canvas id="db-tasks" role="img" aria-label="Tasks completed bar chart"></canvas></div></div>' +
        '<div class="card chart-card"><div class="card-head"><h3>Project distribution</h3></div>' +
          '<div class="chart-box"><canvas id="db-projects" role="img" aria-label="Projects by status"></canvas></div>' +
          '<div class="chart-legend" id="db-legend"></div></div>' +
        '<div class="card chart-card"><div class="card-head"><h3>Productivity trend</h3><span class="small muted">14 day avg</span></div>' +
          '<div class="chart-box"><canvas id="db-trend" role="img" aria-label="Productivity trend"></canvas></div></div>' +
        '<div class="card chart-card"><div class="card-head"><h3>Activity by category</h3></div>' +
          '<div class="chart-box"><canvas id="db-cats" role="img" aria-label="Activity by category"></canvas></div></div>' +
      '</div>'
    ) : '';

    /* assembly */
    var html =
      '<div class="page" data-page="dashboard">' +
      '<div class="page-head"><div><h2>Dashboard</h2>' +
      '<div class="sub" id="db-greet"></div></div></div>' +
      statHtml +
      '<div class="widget-grid" style="margin-top:var(--sp-5);display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-5);align-items:start">' +
        '<div class="widget-stack">' + upcomingHtml + recentActHtml + '</div>' +
        '<div class="widget-stack">' + recentProjHtml + calHtml + mostActivHtml + quickHtml + '</div>' +
      '</div>' +
      charts +
      '</div>';

    main.innerHTML = html;

    var user = MTA.state.currentUser;
    var greet = U.$('#db-greet', main);
    if (greet) {
      var hr = new Date().getHours();
      var part = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
      greet.textContent = part + ', ' + (user ? (user.displayName || user.username) : '') + '.';
    }

    if (!DB._clickBound) {
      DB._clickBound = true;
      main.addEventListener('click', function (e) {
        var q = e.target.closest('[data-qa]');
        if (!q) return;
        e.preventDefault();
        var kind = q.dataset.qa;
        if (kind === 'project') { MTA.router.goto('projects'); setTimeout(function () { var b = document.querySelector('#pj-new'); if (b) b.click(); }, 80); }
        else if (kind === 'note') { MTA.router.goto('devnote'); }
        else if (kind === 'task') { MTA.router.goto('tasks'); setTimeout(function () { var b = document.querySelector('#tk-new'); if (b) b.click(); }, 80); }
        else if (kind === 'event') { MTA.router.goto('calendar'); setTimeout(function () { var b = document.querySelector('#ev-new'); if (b) b.click(); }, 80); }
      });
    }

    /* charts draw */
    if (w('charts')) {
      var actDay = byDayCount(14);
      MTA.charts.line(U.$('#db-activity', main), { labels: actDay.labels, data: actDay.values, height: 205 });

      var taskDay = tasksCompletedByDay(14);
      MTA.charts.bar(U.$('#db-tasks', main), { labels: taskDay.labels, data: taskDay.values, height: 205 });

      var stMap = projectsByStatus();
      var stLabels = Object.keys(stMap).filter(function (k) { return stMap[k] > 0; });
      var stVals = stLabels.map(function (k) { return stMap[k]; });
      var dark = MTA.state.settings && MTA.state.settings.appearance && MTA.state.settings.appearance.theme === 'charcoal';
      var dm = dark
        ? ['#9db4a2', '#8fa9c4', '#d3a963', '#82b8bf', '#a79bc8']
        : ['#55715e', '#5b7c9e', '#b9823f', '#4d818c', '#7b6d9f'];
      U.$('#db-legend', main).innerHTML = stLabels.map(function (l, i) {
        return '<span class="legend-item"><span class="legend-swatch" style="background:' + dm[i % dm.length] + '"></span>' + l + '</span>';
      }).join('');
      MTA.charts.doughnut(U.$('#db-projects', main), {
        labels: stLabels, values: stVals, colors: dm, height: 185,
        centerText: String(stVals.reduce(function (a, b) { return a + b; }, 0)), centerSub: 'projects'
      });

      var trend = productivityTrend(14);
      MTA.charts.line(U.$('#db-trend', main), { labels: trend.labels, data: trend.values, height: 205, fillAlpha: 0.16 });

      var cats = activityByCategory();
      MTA.charts.doughnut(U.$('#db-cats', main), {
        labels: cats.labels, values: cats.values, colors: dm, height: 185,
        centerText: String(cats.values.reduce(function (a, b) { return a + b; }, 0)), centerSub: 'events'
      });
    }
  };

  MTA.dashboard = DB;
})(typeof window !== 'undefined' ? window : this);