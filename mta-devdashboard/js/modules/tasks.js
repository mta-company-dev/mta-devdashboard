/* ============================================================
   MTA DevDashboard - modules/tasks.js
   Complete developer task manager (list + kanban).
   ============================================================ */
(function (global) {
  'use strict';
  var MTA = (global.MTA = global.MTA || {});
  var U = MTA.utils;
  var T = {};

  var STATUSES = ['Todo', 'In Progress', 'Review', 'Done'];
  var PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
  var viewState = { q: '', status: 'All', priority: 'All', project: 'All', view: 'list' };

  T.list = function () { return MTA.store.tasks(); };
  T.get = function (id) {
    return MTA.store.tasks().find(function (t) { return t.id === id; }) || null;
  };

  T.create = function (data) {
    var now = new Date().toISOString();
    var task = Object.assign({
      id: U.uid('tsk'), title: '', description: '', projectId: '',
      priority: 'Medium', status: 'Todo', dueDate: '', tags: [],
      createdAt: now, completedAt: null
    }, data || {});
    if (!task.id) task.id = U.uid('tsk');
    var tasks = T.list();
    tasks.unshift(task);
    MTA.store.saveTasks(tasks);
    var proj = task.projectId ? (MTA.projects ? MTA.projects.get(task.projectId) : null) : null;
    MTA.activity.track('task_create', 'Created task ' + task.title, {
      entityType: 'task', entityId: task.id, project: proj ? proj.name : ''
    });
    MTA.state.bump('tasks');
    return task;
  };

  T.update = function (id, patch) {
    var tasks = T.list();
    var idx = tasks.findIndex(function (t) { return t.id === id; });
    if (idx < 0) return null;
    tasks[idx] = Object.assign({}, tasks[idx], patch);
    if (patch.completedAt !== undefined) {
      /* explicit */
    } else if (patch.status === 'Done' && !tasks[idx].completedAt) {
      tasks[idx].completedAt = new Date().toISOString();
    } else if (patch.status && patch.status !== 'Done') {
      tasks[idx].completedAt = null;
    }
    MTA.store.saveTasks(tasks);
    MTA.state.bump('tasks');
    return tasks[idx];
  };

  T.remove = function (id) {
    var t = T.get(id);
    var tasks = T.list().filter(function (x) { return x.id !== id; });
    MTA.store.saveTasks(tasks);
    if (t) MTA.activity.track('task_edit', 'Deleted task ' + t.title, { entityType: 'task', entityId: id });
    MTA.state.bump('tasks');
  };

  T.toggleDone = function (id) {
    var t = T.get(id);
    if (!t) return;
    if (t.status === 'Done') {
      T.update(id, { status: 'Todo', completedAt: null });
    } else {
      T.update(id, { status: 'Done', completedAt: new Date().toISOString() });
      var proj = t.projectId ? (MTA.projects ? MTA.projects.get(t.projectId) : null) : null;
      MTA.activity.track('task_complete', 'Completed task ' + t.title, {
        entityType: 'task', entityId: id, project: proj ? proj.name : ''
      });
      MTA.toast('Task completed', 'success');
    }
  };

  /* ---------- Filtering ---------- */
  T.filtered = function () {
    var list = T.list();
    var q = viewState.q.toLowerCase();
    if (q) {
      list = list.filter(function (t) {
        return (t.title || '').toLowerCase().indexOf(q) >= 0 ||
          (t.description || '').toLowerCase().indexOf(q) >= 0 ||
          (t.tags || []).join(' ').toLowerCase().indexOf(q) >= 0;
      });
    }
    if (viewState.status !== 'All') list = list.filter(function (t) { return t.status === viewState.status; });
    if (viewState.priority !== 'All') list = list.filter(function (t) { return t.priority === viewState.priority; });
    if (viewState.project !== 'All') list = list.filter(function (t) { return t.projectId === viewState.project; });

    var pidx = { Low: 0, Medium: 1, High: 2, Critical: 3 };
    list.sort(function (a, b) {
      /* in-progress first? No - sort by priority desc then created */
      var pa = pidx[a.priority] || 0, pb = pidx[b.priority] || 0;
      if (pb !== pa) return pb - pa;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    return list;
  };

  T.setViewState = function (patch) { Object.assign(viewState, patch); };
  T.getViewState = function () { return viewState; };

  /* Apply settings defaults once (view only; priority default is for new tasks). */
  function applyDefaultsOnce() {
    if (T._defApplied) return;
    T._defApplied = true;
    var s = MTA.state.settings && MTA.state.settings.tasks;
    if (!s) return;
    if (s.view === 'list' || s.view === 'kanban') viewState.view = s.view;
  }

  /* ---------- Labels ---------- */
  function badge(s, kind) {
    var slug = String(s || '').toLowerCase().replace(/\s+/g, '-');
    if (kind === 'status') {
      return '<span class="badge b-' + slug + '"><span class="b-dot"></span>' + U.esc(s) + '</span>';
    }
    return '<span class="badge b-' + slug + '">' + U.esc(s) + '</span>';
  }

  function dueLabel(t) {
    if (!t.dueDate) return '';
    var dl = U.deadlineLabel(t.dueDate);
    return '<span class="task-due ' + dl.cls + '"><svg class="ic ic-sm" aria-hidden="true"><use href="#ic-clock"></use></svg>' + dl.text + '</span>';
  }

  function projectName(pid) {
    if (!pid) return '';
    var p = MTA.projects ? MTA.projects.get(pid) : null;
    return p ? p.name : '';
  }

  /* ---------- Form ---------- */
  function optionHtml(list, sel) {
    return '<option value="">' + (list.indexOf('') >= 0 ? '' : '—') + '</option>' + list.map(function (v) {
      return '<option value="' + U.esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + U.esc(v) + '</option>';
    }).join('');
  }

  function openForm(task) {
    var editing = !!task;
    var projects = MTA.projects ? MTA.projects.list() : [];
    var projOpts = projects.map(function (p) {
      return '<option value="' + p.id + '"' + (task && task.projectId === p.id ? ' selected' : '') + '>' + U.esc(p.name) + '</option>';
    }).join('');

    var body = U.el('div', {});
    body.innerHTML =
      '<form id="tk-form" class="form-grid">' +
        '<div class="field span2"><label class="field-label">Title <span class="req">*</span></label>' +
          '<input class="input" id="tk-title" required value="' + U.esc((task && task.title) || '') + '" placeholder="Task title"></div>' +
        '<div class="field span2"><label class="field-label">Description</label>' +
          '<textarea class="textarea" id="tk-desc" rows="3" placeholder="Details...">' + U.esc((task && task.description) || '') + '</textarea></div>' +
        '<div class="field"><label class="field-label">Project</label>' +
          '<select class="select" id="tk-proj"><option value="">No project</option>' + projOpts + '</select></div>' +
        '<div class="field"><label class="field-label">Priority</label>' +
          '<select class="select" id="tk-prio">' + PRIORITIES.map(function (p) {
            var sel = task ? task.priority : ((MTA.state.settings && MTA.state.settings.tasks && MTA.state.settings.tasks.priority) || 'Medium');
            return '<option value="' + p + '"' + (sel === p ? ' selected' : '') + '>' + p + '</option>';
          }).join('') + '</select></div>' +
        '<div class="field"><label class="field-label">Status</label>' +
          '<select class="select" id="tk-status">' + STATUSES.map(function (s) {
            return '<option value="' + s + '"' + ((task && task.status) === s ? ' selected' : '') + '>' + s + '</option>';
          }).join('') + '</select></div>' +
        '<div class="field"><label class="field-label">Due date</label>' +
          '<input class="input" type="date" id="tk-due" value="' + U.esc((task && task.dueDate) || '') + '"></div>' +
      '</form>';

    MTA.modal.open({
      title: editing ? 'Edit task' : 'New task',
      body: body,
      actions: [
        { label: 'Cancel', cls: 'btn-ghost' },
        {
          label: editing ? 'Save changes' : 'Create task', cls: 'btn-primary',
          click: function () {
            var title = U.$('#tk-title', body).value.trim();
            if (!title) return false;
            var old = task ? task.status : null;
            var nextStatus = U.$('#tk-status', body).value;
            var patch = {
              title: title,
              description: U.$('#tk-desc', body).value.trim(),
              projectId: U.$('#tk-proj', body).value,
              priority: U.$('#tk-prio', body).value,
              status: nextStatus,
              dueDate: U.$('#tk-due', body).value
            };
            if (editing) {
              T.update(task.id, patch);
              if (old !== 'Done' && nextStatus === 'Done') {
                var p2 = patch.projectId ? (MTA.projects ? MTA.projects.get(patch.projectId) : null) : null;
                MTA.activity.track('task_complete', 'Completed task ' + patch.title, {
                  entityType: 'task', entityId: task.id, project: p2 ? p2.name : ''
                });
              }
              MTA.toast('Task updated', 'success');
            } else {
              T.create(patch);
              MTA.toast('Task created', 'success');
            }
            T.redraw();
            return true;
          }
        }
      ],
      onMount: function () { U.$('#tk-title', body).focus(); }
    });
  }

  /* ---------- Render ---------- */
  T.redraw = function () {
    var main = document.getElementById('app-main');
    T.render(main);
  };

  T.render = function (main) {
    applyDefaultsOnce();
    var tasks = T.filtered();
    var projects = MTA.projects ? MTA.projects.list() : [];

    var projFilterOpts = '<option value="All">All projects</option>' + projects.map(function (p) {
      return '<option value="' + p.id + '"' + (viewState.project === p.id ? ' selected' : '') + '>' + U.esc(p.name) + '</option>';
    }).join('');
    var statusFilterOpts = '<option value="All">All statuses</option>' + STATUSES.map(function (s) {
      return '<option value="' + s + '"' + (viewState.status === s ? ' selected' : '') + '>' + s + '</option>';
    }).join('');
    var prioFilterOpts = '<option value="All">All priorities</option>' + PRIORITIES.map(function (s) {
      return '<option value="' + s + '"' + (viewState.priority === s ? ' selected' : '') + '>' + s + '</option>';
    }).join('');

    var html =
      '<div class="page" data-page="tasks">' +
      '<div class="page-head"><div><h2>Tasks</h2>' +
      '<div class="sub">' + tasks.length + ' shown &middot; ' + T.list().length + ' total</div></div>' +
      '<div class="page-head-actions">' +
        '<div class="seg" role="group" aria-label="View mode">' +
          '<button id="tk-view-list" class="' + (viewState.view === 'list' ? 'active' : '') + '">' + U.icon('ic-list') + ' List</button>' +
          '<button id="tk-view-kanban" class="' + (viewState.view === 'kanban' ? 'active' : '') + '">' + U.icon('ic-grid') + ' Kanban</button>' +
        '</div>' +
        '<button class="btn btn-primary" id="tk-new">' + U.icon('ic-plus') + ' New task</button>' +
      '</div></div>' +

      '<div class="toolbar">' +
        '<div class="searchbox"><svg class="ic-sb" aria-hidden="true"><use href="#ic-search"></use></svg>' +
          '<input class="input" id="tk-q" value="' + U.esc(viewState.q) + '" placeholder="Search tasks..." aria-label="Search tasks"></div>' +
        '<select class="select" id="tk-status-f" style="width:140px">' + statusFilterOpts + '</select>' +
        '<select class="select" id="tk-prio-f" style="width:130px">' + prioFilterOpts + '</select>' +
        '<select class="select" id="tk-proj-f" style="width:170px">' + projFilterOpts + '</select>' +
      '</div>' +
      '<div id="tk-body"></div></div>';

    main.innerHTML = html;
    var body = U.$('#tk-body', main);

    function taskItemHtml(t) {
    var pn = projectName(t.projectId);
    var tags = (t.tags || []).slice(0, 3).map(function (tg) {
      return '<span class="chip tag">' + U.esc(tg) + '</span>';
    }).join('');
    var completeBox = t.status === 'Done'
      ? '<svg class="ic ic-lg" style="color:var(--success)" aria-hidden="true"><use href="#ic-checkc"></use></svg>'
      : '<svg class="ic ic-lg" style="color:var(--text-3)" aria-hidden="true"><use href="#ic-check"></use></svg>';
    return '<div class="task-item' + (t.status === 'Done' ? ' done' : '') + '" data-id="' + t.id + '">' +
      '<button class="task-check js-done" data-id="' + t.id + '" aria-label="Toggle completed">' + completeBox + '</button>' +
      '<div class="grow"><div class="task-title">' + U.esc(t.title) + '</div>' +
        (t.description ? '<div class="small muted">' + U.truncate(t.description, 90) + '</div>' : '') + '</div>' +
      (pn ? '<span class="task-proj"><svg class="ic ic-sm" aria-hidden="true"><use href="#ic-folder"></use></svg><span class="ellipsis">' + U.esc(pn) + '</span></span>' : '') +
      badge(t.status, 'status') + badge(t.priority) +
      dueLabel(t) +
      (tags ? '<span class="row wrap">' + tags + '</span>' : '') +
      '<div class="card-act" style="opacity:1"><button class="icon-btn btn-sm js-edit-t" data-id="' + t.id + '" title="Edit">' + U.icon('ic-edit') + '</button>' +
      '<button class="icon-btn btn-sm js-del-t" data-id="' + t.id + '" title="Delete">' + U.icon('ic-trash') + '</button></div>' +
    '</div>';
  }

  function drawList() {
    if (!tasks.length) {
      body.innerHTML = '<div class="card"><div class="empty"><div class="empty-ic">' + U.icon('ic-tasks') +
        '</div><h3>No tasks' + (viewState.q || viewState.status !== 'All' || viewState.priority !== 'All' || viewState.project !== 'All' ? ' match your filters' : ' yet') + '</h3>' +
        '<div class="empty-actions">' +
        (viewState.q || viewState.status !== 'All' || viewState.priority !== 'All' || viewState.project !== 'All'
          ? '<button class="btn btn-ghost" data-tk-reset>' + U.icon('ic-refresh') + ' Clear filters</button>'
          : '<button class="btn btn-primary" data-tk-new>' + U.icon('ic-plus') + ' New task</button>') +
        '</div></div></div>';
      return;
    }
    body.innerHTML = '<div class="task-list">' + tasks.map(taskItemHtml).join('') + '</div>';
  }

  function drawKanban() {
    var cols = STATUSES.map(function (s) {
      var items = tasks.filter(function (t) { return t.status === s; });
      return '<div class="kanban-col" data-col="' + s + '">' +
        '<div class="kanban-col-head">' + badge(s, 'status') + '<span class="count">' + items.length + '</span></div>' +
        '<div class="kanban-col-body">' +
          (items.length ? items.map(function (t) {
            var dl = t.dueDate ? dueLabel(t) : '';
            return '<div class="kanban-card" data-id="' + t.id + '" draggable="true">' +
              '<div class="kanban-card-title">' + U.esc(t.title) + '</div>' +
              '<div class="row wrap" style="margin-top:6px">' + badge(t.priority) + '</div>' +
              '<div class="row wrap" style="margin-top:4px">' + dl + '</div>' +
            '</div>';
          }).join('')
          : '<div class="empty" style="min-height:60px;padding:var(--sp-3)"><span class="small muted">Drop tasks here</span></div>') +
        '</div></div>';
    }).join('');
    body.innerHTML = '<div class="kanban">' + cols + '</div>';
    wireKanbanDrag(body);
  }

  if (viewState.view === 'kanban') drawKanban(); else drawList();

  /* view switch */
  var listBtn = U.$('#tk-view-list', main);
  var kanBtn = U.$('#tk-view-kanban', main);
  if (listBtn) listBtn.addEventListener('click', function () { viewState.view = 'list'; T.render(main); });
  if (kanBtn) kanBtn.addEventListener('click', function () { viewState.view = 'kanban'; T.render(main); });

  /* toolbar events */
  var q = U.$('#tk-q', main);
  q.addEventListener('input', U.debounce(function () { viewState.q = q.value.trim(); T.render(main); }, 200));
  U.$('#tk-status-f', main).addEventListener('change', function () { viewState.status = this.value; T.render(main); });
  U.$('#tk-prio-f', main).addEventListener('change', function () { viewState.priority = this.value; T.render(main); });
  U.$('#tk-proj-f', main).addEventListener('change', function () { viewState.project = this.value; T.render(main); });
  U.$('#tk-new', main).addEventListener('click', function () { openForm(null); });

  /* ---------- Kanban drag & drop ---------- */
  function wireKanbanDrag(scope) {
    var dragged = null;
    scope.querySelectorAll('.kanban-col').forEach(function (col) {
      col.addEventListener('dragover', function (e) {
        e.preventDefault();
        col.classList.add('drag-over');
      });
      col.addEventListener('dragleave', function () { col.classList.remove('drag-over'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        col.classList.remove('drag-over');
        if (!dragged) return;
        var newStatus = col.dataset.col;
        var card = scope.querySelector('[data-id="' + dragged + '"]');
        if (newStatus) {
          T.update(dragged, { status: newStatus });
          var t = T.get(dragged);
          if (newStatus === 'Done') {
            var p = t && t.projectId ? (MTA.projects ? MTA.projects.get(t.projectId) : null) : null;
            MTA.activity.track('task_complete', 'Completed task ' + (t ? t.title : ''), {
              entityType: 'task', entityId: dragged, project: p ? p.name : ''
            });
            MTA.toast('Task completed', 'success');
          }
          T.render(document.getElementById('app-main'));
        }
        dragged = null;
      });
    });
    scope.addEventListener('dragstart', function (e) {
      var card = e.target.closest('.kanban-card');
      if (!card) return;
      dragged = card.dataset.id;
      card.classList.add('dragging');
    });
    scope.addEventListener('dragend', function (e) {
      var card = e.target.closest('.kanban-card');
      if (card) card.classList.remove('dragging');
      dragged = null;
    });
  }

  /* body event delegation (list + kanban clicks) */
  function wireBodyEvents(scope) {
    scope.addEventListener('click', function (e) {
      var done = e.target.closest('.js-done');
      if (done) { T.toggleDone(done.dataset.id); T.render(document.getElementById('app-main')); return; }
      var edit = e.target.closest('.js-edit-t');
      if (edit) { openForm(T.get(edit.dataset.id)); return; }
      var del = e.target.closest('.js-del-t');
      if (del) {
        var t = T.get(del.dataset.id);
        MTA.modal.confirm({ title: 'Delete task', message: 'Delete "' + (t ? t.title : '') + '"?', danger: true, confirmLabel: 'Delete' })
          .then(function (ok) {
            if (!ok) return;
            T.remove(del.dataset.id);
            MTA.toast('Task deleted', 'warning', 'Deleted');
            T.render(document.getElementById('app-main'));
          });
        return;
      }
      var reset = e.target.closest('[data-tk-reset]');
      if (reset) {
        viewState.q = ''; viewState.status = 'All'; viewState.priority = 'All'; viewState.project = 'All';
        T.render(document.getElementById('app-main'));
        return;
      }
      var newBtn = e.target.closest('[data-tk-new]');
      if (newBtn) openForm(null);
    });
  }
  wireBodyEvents(body);
  };

  MTA.tasks = T;
})(typeof window !== 'undefined' ? window : this);