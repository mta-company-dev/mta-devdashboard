/* ============================================================
   MTA DevDashboard - modules/activity.js
   Real local activity tracking + analytics.
   No fabricated data - everything derives from mta_activity.
   ============================================================ */
(function (global) {
  'use strict';
  var MTA = (global.MTA = global.MTA || {});
  var U = MTA.utils;
  var A = {};
  var renderState = { range: '7d', customStart: U.todayStr(), customEnd: U.todayStr() };

  /* ---------- Tracking ---------- */
  A.track = function (type, action, extra, userId) {
    var act = MTA.store.activity();
    act.push(Object.assign({
      id: U.uid('act'),
      type: type,
      action: action,
      userId: userId || (MTA.state.currentUser ? MTA.state.currentUser.id : null),
      timestamp: new Date().toISOString()
    }, extra || {}));
    MTA.store.saveActivity(act);
    MTA.state.bump('data');
  };

  /* ---------- Range helpers ---------- */
  A.rangeStart = function (range, customStart, customEnd) {
    var now = new Date();
    if (range === 'today') return U.startOfDay(now);
    if (range === 'yesterday') {
      var y = U.startOfDay(now);
      y.setDate(y.getDate() - 1);
      return y;
    }
    if (range === '7d') return U.addDays(U.startOfDay(now), -6);
    if (range === '30d') return U.addDays(U.startOfDay(now), -29);
    if (range === '3m') return U.addDays(U.startOfDay(now), -90);
    if (range === '6m') return U.addDays(U.startOfDay(now), -182);
    if (range === '1y') return U.addDays(U.startOfDay(now), -364);
    if (range === 'custom') return U.parseDay(customStart);
    return U.addDays(U.startOfDay(now), -6);
  };

  A.rangeEnd = function (range, customStart, customEnd) {
    if (range === 'yesterday') {
      var y = U.startOfDay(new Date());
      y.setDate(y.getDate() - 1);
      return y;
    }
    if (range === 'custom') return U.parseDay(customEnd);
    return U.startOfDay(new Date());
  };

  A.filter = function (range, customStart, customEnd) {
    var start = A.rangeStart(range, customStart, customEnd);
    var end = A.rangeEnd(range, customStart, customEnd);
    var arr = MTA.store.activity();
    return arr.filter(function (a) {
      var d = U.toDate(a.timestamp);
      if (!d) return false;
      var s = U.startOfDay(d);
      return s >= start && s <= end;
    });
  };

  /* ---------- Aggregations ---------- */
  A.byDay = function (items, days) {
    var map = {};
    var now = U.startOfDay(new Date());
    for (var i = days - 1; i >= 0; i--) {
      var d = U.dateStr(U.addDays(now, -i));
      map[d] = 0;
    }
    items.forEach(function (a) {
      var d = U.dateStr(U.toDate(a.timestamp));
      if (map[d] != null) map[d]++;
    });
    var labels = Object.keys(map).map(function (k) { return k.slice(5); });
    return { labels: labels, values: Object.keys(map).map(function (k) { return map[k]; }) };
  };

  A.byType = function (items) {
    var map = {};
    items.forEach(function (a) { map[a.type] = (map[a.type] || 0) + 1; });
    return Object.keys(map).map(function (k) { return { type: k, count: map[k] }; })
      .sort(function (a, b) { return b.count - a.count; });
  };

  A.byPage = function (items) {
    return A.byType(items.filter(function (a) { return a.type === 'navigation'; }));
  };

  A.activeProjects = function (items) {
    var map = {};
    ['project_create', 'project_edit', 'task_complete', 'task_create'].forEach(function (t) {
      items.filter(function (a) { return a.type === t; }).forEach(function (a) {
        var proj = a.project || a.entityDescription || 'unknown';
        map[proj] = (map[proj] || 0) + 1;
        if (a.extra && a.extra.project) {
          map[a.extra.project] = (map[a.extra.project] || 0) + 1;
        }
      });
    });
    items.filter(function (a) { return a.project; }).forEach(function (a) {
      map[a.project] = (map[a.project] || 0) + 1;
    });
    return Object.keys(map).map(function (k) { return { name: k, count: map[k] }; })
      .sort(function (a, b) { return b.count - a.count; });
  };

  A.tasksCompleted = function (items) {
    return items.filter(function (a) { return a.type === 'task_complete'; }).length;
  };
  A.notesCreated = function (items) {
    return items.filter(function (a) { return a.type === 'note_create'; }).length;
  };
  A.projectsCreated = function (items) {
    return items.filter(function (a) { return a.type === 'project_create'; }).length;
  };
  A.eventsCreated = function (items) {
    return items.filter(function (a) { return a.type === 'event_create'; }).length;
  };

  /* ---------- Render helpers ---------- */
  function typeIcon(t) {
    var map = {
      login: 'ic-lock', logout: 'ic-logout', navigation: 'ic-activity',
      project_create: 'ic-folder', project_edit: 'ic-edit', project_delete: 'ic-trash',
      task_create: 'ic-plus', task_complete: 'ic-checkc', task_edit: 'ic-edit',
      note_create: 'ic-note', note_edit: 'ic-edit', note_pin: 'ic-pin',
      event_create: 'ic-calendar', event_edit: 'ic-edit',
      settings: 'ic-settings', system: 'ic-settings', password: 'ic-lock'
    };
    return map[t] || 'ic-zap';
  }

  function fmtAction(a) {
    return String(a.action || '').replace(/</g, '&lt;');
  }

  function feedItems(items) {
    return items.slice(0, 60).map(function (a) {
      return '<div class="feed-item">' +
        '<div class="feed-ic type-' + U.esc(a.type) + '">' + U.icon(typeIcon(a.type)) + '</div>' +
        '<div class="feed-body">' +
          '<div class="feed-text">' + fmtAction(a) + '</div>' +
          '<div class="feed-meta">' + U.esc(a.type) + ' &middot; ' + U.timeAgo(a.timestamp) +
          (a.project ? ' &middot; ' + U.esc(a.project) : '') + '</div>' +
        '</div>' +
        '<div class="wi-time">' + U.fmtDateTime(a.timestamp) + '</div>' +
      '</div>';
    }).join('');
  }

  var RANGES = [['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', '7 Days'],
    ['30d', '30 Days'], ['3m', '3 Months'], ['6m', '6 Months'], ['1y', '1 Year'], ['custom', 'Custom']];

  /* ---------- Page render ---------- */
  A.render = function (main) {
    var items = A.filter(renderState.range, renderState.customStart, renderState.customEnd);
    var chips = RANGES.map(function (r) {
      return '<button class="feed-chip' + (renderState.range === r[0] ? ' active' : '') +
        '" data-range="' + r[0] + '">' + r[1] + '</button>';
    }).join('');

    var custom = renderState.range === 'custom'
      ? '<span class="feed-custom"><input type="date" class="input" id="act-from" value="' +
        renderState.customStart + '" aria-label="From"><span>to</span>' +
        '<input type="date" class="input" id="act-to" value="' + renderState.customEnd +
        '" aria-label="To"></span>'
      : '';

    var byDay = A.byDay(items, renderState.range === 'today' ? 1 : (renderState.range === '30d' || renderState.range === '3m') ? 14 : 7);
    var byType = A.byType(items);
    var pages = A.byPage(items);
    var projs = A.activeProjects(items);
    var total = items.length;

    var html =
      '<div class="page" data-page="activity">' +
      '<div class="page-head"><div><h2>Activity</h2>' +
      '<div class="sub">Real usage analytics from your local workspace</div></div></div>' +

      '<div class="toolbar"><div class="feed-filter">' + chips + '</div>' + custom +
      '<div class="spacer"></div><span class="small muted" id="act-total"></span></div>' +

      '<div class="stats-grid" id="act-stats"></div>' +

      '<div class="dash-charts" style="margin-top:var(--sp-5)">' +
        '<div class="card chart-card"><div class="card-head"><h3>Daily activity</h3></div>' +
          '<div class="chart-box"><canvas id="act-line" role="img" aria-label="Daily activity line chart"></canvas></div></div>' +
        '<div class="card chart-card"><div class="card-head"><h3>Activity by type</h3></div>' +
          '<div class="chart-box"><canvas id="act-doughnut" role="img" aria-label="Activity by type doughnut chart"></canvas></div>' +
          '<div class="chart-legend" id="act-legend"></div></div>' +
        '<div class="card chart-card"><div class="card-head"><h3>Most-used sections</h3></div>' +
          '<div class="chart-box"><canvas id="act-bar" role="img" aria-label="Most used sections bar chart"></canvas></div></div>' +
        '<div class="card chart-card"><div class="card-head"><h3>Most active projects</h3></div>' +
          '<div class="feed" id="act-proj-list"></div></div>' +
      '</div>' +

      '<div class="card" style="margin-top:var(--sp-5)"><div class="card-head"><h3>Recent activity</h3>' +
      '<button class="btn btn-sm btn-ghost" id="act-refresh">' + U.icon('ic-refresh') + ' Refresh</button></div>' +
      '<div class="feed" id="act-feed"></div></div>' +
      '</div>';

    main.innerHTML = html;
    var totalEl = U.$('#act-total', main);
    totalEl.textContent = total + ' events';

    /* stat cards */
    var stats = [
      { label: 'Active events', value: total, icon: 'ic-activity', cls: 'st-info' },
      { label: 'Tasks completed', value: A.tasksCompleted(items), icon: 'ic-checkc', cls: 'st-success' },
      { label: 'Notes created', value: A.notesCreated(items), icon: 'ic-note', cls: 'st-warn' },
      { label: 'Projects created', value: A.projectsCreated(items), icon: 'ic-folder', cls: 'st-info' },
      { label: 'Calendar events', value: A.eventsCreated(items), icon: 'ic-calendar', cls: 'st-danger' },
      { label: 'Sections visited', value: pages.filter(function (p) { return p.count > 0; }).length, icon: 'ic-dashboard', cls: 'st-accent' }
    ];
    U.$('#act-stats', main).innerHTML = stats.map(function (s) {
      return '<div class="card stat-card"><div class="stat-icon ' + s.cls + '">' + U.icon(s.icon) +
        '</div><div><div class="stat-value">' + s.value + '</div><div class="stat-label">' + s.label + '</div></div></div>';
    }).join('');

    /* charts */
    var lineCanvas = U.$('#act-line', main);
    MTA.charts.line(lineCanvas, { labels: byDay.labels, data: byDay.values, height: 220 });

    var cols = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6'];
    function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888'; }
    var colors = cols.map(css);
    var dValues = byType.slice(0, 6).map(function (x) { return x.count; });
    var dLabels = byType.slice(0, 6).map(function (x) { return x.type; });
    U.$('#act-legend', main).innerHTML = dLabels.map(function (l, i) {
      return '<span class="legend-item"><span class="legend-swatch" style="background:' + colors[i] + '"></span>' + l + '</span>';
    }).join('');
    MTA.charts.doughnut(U.$('#act-doughnut', main), {
      values: dValues, labels: dLabels, colors: colors, height: 200,
      centerText: String(total), centerSub: 'events'
    });

    var barData = pages.slice(0, 8);
    MTA.charts.bar(U.$('#act-bar', main), {
      labels: barData.map(function (x) { return x.type; }),
      data: barData.map(function (x) { return x.count; }),
      height: 220
    });

    /* project list */
    var projEl = U.$('#act-proj-list', main);
    if (projs.length === 0) {
      projEl.innerHTML = '<div class="empty">no projects yet</div>';
    } else {
      projEl.innerHTML = '<div class="card-body" style="padding:0">' + projs.slice(0, 6).map(function (p) {
        return '<div class="widget-item"><span class="wi-ic">' + U.icon('ic-folder') + '</span>' +
          '<span class="wi-body"><span class="wi-title ellipsis">' + U.esc(p.name) + '</span></span>' +
          '<div class="progress" style="width:70px;flex:none"><span style="width:' +
          Math.min(100, p.count * 20) + '%"></span></div>' +
          '<span class="wi-time">' + p.count + '</span></div>';
      }).join('') + '</div>';
    }

    /* feed */
    U.$('#act-feed', main).innerHTML = items.length
      ? feedItems(items)
      : '<div class="empty"><div class="empty-ic">' + U.icon('ic-activity') +
        '</div><h3>No activity in this range</h3><p>Work inside the dashboard and it will appear here.</p></div>';

    /* wire events */
    U.$$('.feed-chip', main).forEach(function (c) {
      c.addEventListener('click', function () {
        renderState.range = c.dataset.range;
        A.render(main);
      });
    });
    var from = U.$('#act-from', main), to = U.$('#act-to', main);
    if (from) {
      from.addEventListener('change', function () { renderState.customStart = from.value; A.render(main); });
    }
    if (to) {
      to.addEventListener('change', function () { renderState.customEnd = to.value; A.render(main); });
    }
    var refresh = U.$('#act-refresh', main);
    if (refresh) refresh.addEventListener('click', function () { A.render(main); });
  };

  MTA.activity = A;
})(typeof window !== 'undefined' ? window : this);