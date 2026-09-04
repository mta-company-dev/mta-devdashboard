/* ============================================================
   MTA DevDashboard - modules/calendar.js
   Local calendar: month / week / day views, events, task
   deadline overlays.
   ============================================================ */
(function (global) {
  'use strict';
  var MTA = (global.MTA = global.MTA || {});
  var U = MTA.utils;
  var C = {};

  var state = {
    view: 'month',
    cursor: U.startOfDay(new Date()),
    day: U.startOfDay(new Date())
  };

  var COLORS = ['ec-1', 'ec-2', 'ec-3', 'ec-4', 'ec-5', 'ec-6'];

  C.list = function () { return MTA.store.events(); };
  C.get = function (id) {
    return MTA.store.events().find(function (e) { return e.id === id; }) || null;
  };

  C.create = function (data) {
    var now = new Date().toISOString();
    var ev = Object.assign({
      id: U.uid('ev'), title: '', description: '', allDay: false,
      start: now, end: now, color: 1, createdAt: now, updatedAt: now
    }, data || {});
    if (!ev.id) ev.id = U.uid('ev');
    var list = C.list();
    list.push(ev);
    MTA.store.saveEvents(list);
    MTA.activity.track('event_create', 'Created event ' + ev.title, { entityType: 'event', entityId: ev.id });
    MTA.state.bump('events');
    return ev;
  };

  C.update = function (id, patch) {
    var list = C.list();
    var idx = list.findIndex(function (e) { return e.id === id; });
    if (idx < 0) return null;
    list[idx] = Object.assign({}, list[idx], patch, { updatedAt: new Date().toISOString() });
    MTA.store.saveEvents(list);
    MTA.activity.track('event_edit', 'Edited event ' + list[idx].title, { entityType: 'event', entityId: id });
    MTA.state.bump('events');
    return list[idx];
  };

  C.remove = function (id) {
    var e = C.get(id);
    var list = C.list().filter(function (x) { return x.id !== id; });
    MTA.store.saveEvents(list);
    if (e) MTA.activity.track('event_delete', 'Deleted event ' + e.title, { entityType: 'event', entityId: id });
    MTA.state.bump('events');
  };

  /* ---------- Helpers ---------- */
  /* Events whose date range intersects target Date (day granularity). */
  C.eventsOn = function (day, events) {
    var ds = U.dateStr(day);
    events = events || C.list();
    return events.filter(function (e) {
      var startD = U.toDate(e.start);
      var endD = U.toDate(e.end);
      if (!startD) return false;
      if (!endD) endD = startD;
      var s = U.dateStr(startD);
      var en = U.dateStr(endD);
      return ds >= s && ds <= en;
    });
  };

  function monthMatrix(monthStart, startDay) {
    var first = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
    var lead = (first.getDay() - startDay + 7) % 7;
    var days = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    var cells = [];
    for (var i = 0; i < lead; i++) cells.push(null);
    for (var d = 1; d <= days; d++) cells.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function startOfWeek(d, startDay) {
    var r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var delta = (r.getDay() - startDay + 7) % 7;
    r.setDate(r.getDate() - delta);
    return r;
  }

  /* Task deadlines for a day -> array of tasks. */
  function taskDeadlinesOn(day) {
    var ds = U.dateStr(day);
    return MTA.store.tasks().filter(function (t) {
      return t.dueDate && t.dueDate === ds && t.status !== 'Done';
    });
  }

  /* ---------- Event + task chips ---------- */
  function evChip(e, opts) {
    var color = COLORS[(e.color || 1) - 1] || 'ec-1';
    var time = '';
    if (!e.allDay) {
      var s = U.toDate(e.start);
      if (s) time = U.fmtTime(s);
    } else {
      time = 'All day';
    }
    return '<div class="cal-event ' + color + (e.allDay ? ' all-day' : '') + '" data-eid="' + e.id + '" title="' +
      U.esc(e.title) + '">' + '<span class="small">' + (time ? time + ' &middot; ' : '') + '</span>' +
      '<span class="ellipsis">' + U.esc(e.title) + '</span></div>';
  }

  function taskChip(t) {
    return '<div class="cal-event task-deadline" data-tid="' + t.id + '" title="Task deadline: ' + U.esc(t.title) + '">' +
      '<svg class="ic ic-sm" aria-hidden="true"><use href="#ic-tasks"></use></svg> ' + U.esc(t.title) + '</div>';
  }

  function cellEvents(day, events) {
    var evs = C.eventsOn(day, events);
    var tasks = taskDeadlinesOn(day);
    return evs.map(evChip).concat(tasks.map(taskChip));
  }

  /* ---------- Month view ---------- */
  function renderMonth(main, events) {
    var today = U.todayStr();
    var startDay = (MTA.state.settings && MTA.state.settings.calendar && MTA.state.settings.calendar.startDay) || 1;
    var matrix = monthMatrix(state.cursor, startDay);
    var weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var wd = weekdays.map(function (w, i) {
      return '<div class="cal-weekday">' + weekdays[(i + startDay) % 7] + '</div>';
    }).join('');

    var cells = matrix.map(function (d, i) {
      if (!d) return '<div class="cal-cell out-month"><span class="day-num"></span></div>';
      var ds = U.dateStr(d);
      var inMonth = d.getMonth() === state.cursor.getMonth();
      var isToday = ds === today;
      var chips = cellEvents(d, events).slice(0, 4);
      return '<div class="cal-cell' + (inMonth ? '' : ' out-month') + (isToday ? ' today' : '') + '" data-day="' + ds + '" tabindex="0">' +
        '<span class="day-num">' + d.getDate() + '</span>' +
        '<div class="cal-events">' + chips.join('') + '</div>' +
      '</div>';
    }).join('');

    return '<div class="card" style="padding:var(--sp-4)"><div class="cal">' +
      '<div class="cal-head">' +
        '<h3 class="cal-title">' + U.monthName(state.cursor.getMonth()) + ' ' + state.cursor.getFullYear() + '</h3>' +
        '<div class="cal-nav">' +
          '<button class="btn btn-sm" data-cal="today">Today</button>' +
          '<button class="icon-btn" data-cal="prev">' + U.icon('ic-chevL') + '</button>' +
          '<button class="icon-btn" data-cal="next">' + U.icon('ic-chevR') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="cal-grid">' + wd + cells + '</div></div></div>';
  }

  /* ---------- Week / Day views ---------- */
  function hourLabels() {
    var h = '';
    for (var i = 0; i < 24; i++) {
      var val = U.pad2(i) + ':00';
      h += '<div class="cal-hour"><span class="small">' + val + '</span></div>';
    }
    return h;
  }

  function renderWeek(main, events, dayMode) {
    var startDay = (MTA.state.settings && MTA.state.settings.calendar && MTA.state.settings.calendar.startDay) || 1;
    var today = U.todayStr();
    var days = [];
    if (dayMode) {
      days.push(new Date(state.cursor.getFullYear(), state.cursor.getMonth(), state.cursor.getDate()));
    } else {
      var start = startOfWeek(state.cursor, startDay);
      for (var i = 0; i < 7; i++) days.push(U.addDays(start, i));
    }

    var cols = days.map(function (d) {
      var ds = U.dateStr(d);
      var timed = [], allDay = [];
      C.eventsOn(d, events).forEach(function (e) {
        if (e.allDay) allDay.push(e);
        else timed.push(e);
      });
      taskDeadlinesOn(d).forEach(function (t) {
        allDay.push({ __task: true, title: t.title, id: t.id });
      });

      var allDayHtml = allDay.map(function (e) {
        if (e.__task) {
          return '<div class="cal-all-day-chip ec-4 task-deadline" data-tid="' + e.id + '">' + U.esc(e.title) + '</div>';
        }
        return '<div class="cal-all-day-chip ' + (COLORS[(e.color || 1) - 1]) + '" data-eid="' + e.id + '">' + U.esc(e.title) + '</div>';
      }).join('');

      var slotHtml = timed.map(function (e) {
        var sd = U.toDate(e.start), ed = U.toDate(e.end) || sd;
        var top = sd.getHours() * 60 + sd.getMinutes();
        var dur = Math.max(30, (ed.getTime() - sd.getTime()) / 60000);
        return '<div class="cal-slot ' + (COLORS[(e.color || 1) - 1]) + '" data-eid="' + e.id + '" style="top:' +
          top + 'px;height:' + dur + 'px;left:2px;right:2px">' +
          '<b>' + U.fmtTime(sd) + '</b> &nbsp;' + U.esc(e.title) + '</div>';
      }).join('');

      return '<div class="cal-week-day' + (ds === today ? ' today' : '') + '">' +
        '<div class="cal-week-day-head">' + U.shortDayName(d.getDay(), startDay === 1) +
        '<span class="wno">' + d.getDate() + '</span></div>' +
        '<div class="cal-all-day-row"><div class="cal-all-day-cell">' + allDayHtml + '</div></div>' +
        '<div class="cal-week-body">' + slotHtml + '</div>' +
      '</div>';
    }).join('');

    var title = dayMode ? U.fmtDate(days[0]) : (U.fmtDate(days[0]) + ' — ' + U.fmtDate(days[days.length - 1]));

    return '<div class="card" style="padding:var(--sp-4)"><div class="cal">' +
      '<div class="cal-head">' +
        '<h3 class="cal-title">' + title + '</h3>' +
        '<div class="cal-nav">' +
          '<button class="btn btn-sm" data-cal="today">Today</button>' +
          '<button class="icon-btn" data-cal="prev">' + U.icon('ic-chevL') + '</button>' +
          '<button class="icon-btn" data-cal="next">' + U.icon('ic-chevR') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="cal-week' + (dayMode ? ' mode-day' : '') + '">' +
        '<div class="cal-time-col">' + hourLabels() + '</div>' + cols +
      '</div></div></div>';
  }

  /* ---------- Event form ---------- */
  function openEventForm(evObj, defaultDay) {
    var editing = !!evObj;
    var defaultDur = (MTA.state.settings && MTA.state.settings.calendar && MTA.state.settings.calendar.defaultDuration) || 60;
    var startVal = '';
    var endVal = '';
    if (evObj) {
      var s = U.toDate(evObj.start);
      var e = U.toDate(evObj.end);
      if (s) startVal = U.dateStr(s) + 'T' + U.pad2(s.getHours()) + ':' + U.pad2(s.getMinutes());
      if (e) endVal = U.dateStr(e) + 'T' + U.pad2(e.getHours()) + ':' + U.pad2(e.getMinutes());
      if (evObj.allDay && !startVal) startVal = (evObj.start || '').slice(0, 10);
      if (evObj.allDay && !endVal) endVal = (evObj.end || '').slice(0, 10);
    } else {
      var base = U.parseDay(defaultDay) || new Date();
      var curH = base.getHours();
      startVal = U.dateStr(base) + 'T' + U.pad2(curH) + ':' + U.pad2(base.getMinutes());
      var endD = U.addMinutes(base, defaultDur);
      endVal = U.dateStr(endD) + 'T' + U.pad2(endD.getHours()) + ':' + U.pad2(endD.getMinutes());
    }

    var body = U.el('div', {});
    body.innerHTML =
      '<form class="form-grid">' +
        '<div class="field span2"><label class="field-label">Title <span class="req">*</span></label>' +
          '<input class="input" id="ev-title" required value="' + U.esc(evObj ? evObj.title : '') + '" placeholder="Event title"></div>' +
        '<div class="field span2"><label class="field-label">Description</label>' +
          '<textarea class="textarea" id="ev-desc" rows="2" placeholder="Details...">' + U.esc(evObj ? (evObj.description || '') : '') + '</textarea></div>' +
        '<div class="field span2"><label class="switch"><input type="checkbox" id="ev-allday"' + (evObj && evObj.allDay ? ' checked' : '') + '><span>All-day event</span></label></div>' +
        '<div class="field"><label class="field-label">Start</label>' +
          '<input class="input" type="datetime-local" id="ev-start" value="' + startVal + '"></div>' +
        '<div class="field"><label class="field-label">End</label>' +
          '<input class="input" type="datetime-local" id="ev-end" value="' + endVal + '"></div>' +
        '<div class="field span2"><label class="field-label">Color</label>' +
          '<div class="row" id="ev-colors"></div></div>' +
      '</form>';

    var colorBox = U.$('#ev-colors', body);
    var swatches = ['#55715e', '#5f7c9e', '#b9823f', '#a6534a', '#3e7a55', '#766a9c'];
    var chosen = evObj ? (evObj.color || 1) : 1;
    swatches.forEach(function (c, i) {
      var b = U.el('button', {
        type: 'button', class: 'avatar-swatch' + (chosen === i + 1 ? ' on' : ''),
        style: 'background:' + c, 'aria-label': 'Color ' + (i + 1)
      });
      b.addEventListener('click', function () {
        chosen = i + 1;
        U.$$('.avatar-swatch', colorBox).forEach(function (s) { s.classList.remove('on'); });
        b.classList.add('on');
      });
      colorBox.appendChild(b);
    });
    var allDayBox = U.$('#ev-allday', body);

    MTA.modal.open({
      title: editing ? 'Edit event' : 'New event',
      body: body,
      actions: [
        { label: 'Cancel', cls: 'btn-ghost' },
        {
          label: editing ? 'Save changes' : 'Create event', cls: 'btn-primary',
          click: function () {
            var title = U.$('#ev-title', body).value.trim();
            if (!title) return false;
            var allDay = allDayBox.checked;
            var startV = U.$('#ev-start', body).value;
            var endV = U.$('#ev-end', body).value;
            var data = {
              title: title,
              description: U.$('#ev-desc', body).value.trim(),
              allDay: allDay,
              start: allDay ? (startV || U.todayStr()) : new Date(startV).toISOString(),
              end: allDay ? (endV || startV || U.todayStr()) : new Date(endV).toISOString(),
              color: chosen
            };
            if (editing) {
              C.update(evObj.id, data);
              MTA.toast('Event updated', 'success');
            } else {
              C.create(data);
              MTA.toast('Event created', 'success');
            }
            C.redraw();
            return true;
          }
        }
      ],
      onMount: function () { U.$('#ev-title', body).focus(); }
    });
  }

  /* ---------- Main render ---------- */
  C.redraw = function () {
    var main = document.getElementById('app-main');
    C.render(main);
  };

  C.render = function (main) {
    var events = C.list();
    var html =
      '<div class="page" data-page="calendar">' +
      '<div class="page-head"><div><h2>Calendar</h2>' +
      '<div class="sub">' + events.length + ' events</div></div>' +
      '<div class="page-head-actions">' +
        '<div class="seg" role="group" aria-label="Calendar view">' +
          '<button data-cv="month" class="' + (state.view === 'month' ? 'active' : '') + '">Month</button>' +
          '<button data-cv="week" class="' + (state.view === 'week' ? 'active' : '') + '">Week</button>' +
          '<button data-cv="day" class="' + (state.view === 'day' ? 'active' : '') + '">Day</button>' +
        '</div>' +
        '<button class="btn btn-primary" id="ev-new">' + U.icon('ic-plus') + ' New event</button>' +
      '</div></div>' +
      '<div id="cal-body"></div></div>';

    main.innerHTML = html;
    var body = U.$('#cal-body', main);

    function draw() {
      if (state.view === 'month') body.innerHTML = renderMonth(main, events);
      else if (state.view === 'day') body.innerHTML = renderWeek(main, events, true);
      else body.innerHTML = renderWeek(main, events, false);
      wireCalEvents(body);
    }
    draw();

    U.$$('[data-cv]', main).forEach(function (b) {
      b.addEventListener('click', function () {
        state.view = b.dataset.cv;
        C.render(main);
      });
    });
    U.$('#ev-new', main).addEventListener('click', function () {
      openEventForm(null, U.todayStr());
    });
  };

  /* wire calendar interactions */
  function wireCalEvents(body) {
    body.addEventListener('click', function (e) {
      var cell = e.target.closest('.cal-cell');
      if (cell && cell.dataset.day) { openEventForm(null, cell.dataset.day); return; }

      var nav = e.target.closest('[data-cal]');
      if (nav) {
        var dir = nav.dataset.cal;
        if (dir === 'today') state.cursor = U.startOfDay(new Date());
        else if (dir === 'prev') state.cursor = U.addDays(state.cursor, state.view === 'month' ? -30 : state.view === 'week' ? -7 : -1);
        else if (dir === 'next') state.cursor = U.addDays(state.cursor, state.view === 'month' ? 30 : state.view === 'week' ? 7 : 1);
        C.redraw();
        return;
      }

      var evChip = e.target.closest('[data-eid]');
      if (evChip) {
        e.stopPropagation();
        var ev = C.get(evChip.dataset.eid);
        if (ev) openEventDetails(ev);
        return;
      }
      var tChip = e.target.closest('[data-tid]');
      if (tChip) {
        e.stopPropagation();
        MTA.router.goto('tasks');
        return;
      }
    });
    body.addEventListener('keydown', function (e) {
      var cell = e.target.closest('.cal-cell');
      if (cell && cell.dataset.day && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        openEventForm(null, cell.dataset.day);
      }
    });
  }

  /* event details drawer */
  function openEventDetails(ev) {
    var body = U.el('div', {});
    body.innerHTML =
      (ev.description ? '<p class="small">' + U.esc(ev.description) + '</p><div style="height:1px;background:var(--border);margin:10px 0"></div>' : '') +
      '<div class="detail-grid">' +
        '<div class="detail-item"><div class="k">Start</div><div class="v">' + (ev.allDay ? U.fmtDate(ev.start) : U.fmtDateTime(ev.start)) + '</div></div>' +
        '<div class="detail-item"><div class="k">End</div><div class="v">' + (ev.allDay ? U.fmtDate(ev.end) : U.fmtDateTime(ev.end)) + '</div></div>' +
        '<div class="detail-item"><div class="k">Type</div><div class="v">' + (ev.allDay ? 'All-day' : 'Timed') + '</div></div>' +
      '</div>';

    MTA.modal.drawer({
      title: ev.title,
      body: body,
      footer: '<button class="btn" id="ev-d-edit">' + U.icon('ic-edit') + ' Edit</button>' +
        '<button class="btn btn-danger" id="ev-d-del">' + U.icon('ic-trash') + ' Delete</button>',
      onMount: function (d) {
        U.$('#ev-d-edit', d.body).addEventListener('click', function () {
          d.close();
          openEventForm(ev);
        });
        U.$('#ev-d-del', d.body).addEventListener('click', function () {
          d.close();
          MTA.modal.confirm({ title: 'Delete event', message: 'Delete "' + ev.title + '"?', danger: true, confirmLabel: 'Delete' })
            .then(function (ok) {
              if (!ok) return;
              C.remove(ev.id);
              MTA.toast('Event deleted', 'warning', 'Deleted');
              C.redraw();
            });
        });
      }
    });
  }

  C.state = state;
  MTA.calendar = C;
})(typeof window !== 'undefined' ? window : this);