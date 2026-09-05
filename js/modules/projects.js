/* ============================================================
   MTA DevDashboard - modules/projects.js
   Full CRUD project manager.
   ============================================================ */
(function (global) {
  'use strict';
  var MTA = (global.MTA = global.MTA || {});
  var U = MTA.utils;
  var P = {};

  var STATii = ['Planning', 'Development', 'Testing', 'Deployed', 'Archived'];
  var PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
  var viewState = {
    q: '', status: 'All', priority: 'All', category: 'All', sort: 'updated_desc',
    view: 'grid', favOnly: false
  };

  P.categories = function (projects) {
    var set = {};
    projects.forEach(function (p) { if (p.category) set[p.category] = true; });
    return Object.keys(set);
  };

  /* ---------- Collection ops ---------- */
  P.list = function () { return MTA.store.projects(); };
  P.get = function (id) {
    return MTA.store.projects().find(function (p) { return p.id === id; }) || null;
  };

  P.create = function (data) {
    var projects = P.list();
    var now = new Date().toISOString();
    var p = Object.assign({
      id: U.uid('prj'), name: '', description: '', category: '',
      tags: [], status: 'Planning', priority: 'Medium', progress: 0,
      startDate: '', deadline: '', repoUrl: '', liveUrl: '', localPath: '',
      notes: '', favorite: false, createdAt: now, updatedAt: now
    }, data, { id: data.id || U.uid('prj'), createdAt: now, updatedAt: now });
    projects.unshift(p);
    MTA.store.saveProjects(projects);
    MTA.activity.track('project_create', 'Created project ' + p.name, { entityType: 'project', entityId: p.id });
    MTA.state.bump('projects');
    return p;
  };

  P.update = function (id, data) {
    var projects = P.list();
    var idx = projects.findIndex(function (p) { return p.id === id; });
    if (idx < 0) return null;
    projects[idx] = Object.assign({}, projects[idx], data, { updatedAt: new Date().toISOString() });
    MTA.store.saveProjects(projects);
    MTA.activity.track('project_edit', 'Edited project ' + projects[idx].name, { entityType: 'project', entityId: id });
    MTA.state.bump('projects');
    return projects[idx];
  };

  P.remove = function (id) {
    var projects = P.list();
    var p = projects.find(function (x) { return x.id === id; });
    projects = projects.filter(function (x) { return x.id !== id; });
    MTA.store.saveProjects(projects);
    if (p) MTA.activity.track('project_delete', 'Deleted project ' + p.name, { entityType: 'project', entityId: id });
    MTA.state.bump('projects');
  };

  P.toggleFavorite = function (id) {
    var p = P.get(id);
    if (!p) return;
    P.update(id, { favorite: !p.favorite });
  };

  /* ---------- Filtering ---------- */
  P.filtered = function () {
    var list = P.list();
    var q = viewState.q.toLowerCase();
    if (q) {
      list = list.filter(function (p) {
        return (p.name || '').toLowerCase().indexOf(q) >= 0 ||
          (p.description || '').toLowerCase().indexOf(q) >= 0 ||
          (p.tags || []).join(' ').toLowerCase().indexOf(q) >= 0 ||
          (p.category || '').toLowerCase().indexOf(q) >= 0;
      });
    }
    if (viewState.status !== 'All') list = list.filter(function (p) { return p.status === viewState.status; });
    if (viewState.priority !== 'All') list = list.filter(function (p) { return p.priority === viewState.priority; });
    if (viewState.category !== 'All') list = list.filter(function (p) { return p.category === viewState.category; });
    if (viewState.favOnly) list = list.filter(function (p) { return p.favorite; });

    var key = String(viewState.sort).replace(/_(asc|desc)$/, '');
    var dir = /_desc$/.test(viewState.sort) ? 'desc' : 'asc';
    list.sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = (a.name || '').toLowerCase(); bv = (b.name || '').toLowerCase(); }
      else if (key === 'progress') { av = +a.progress || 0; bv = +b.progress || 0; }
      else if (key === 'deadline') { av = a.deadline || '9999'; bv = b.deadline || '9999'; }
      else if (key === 'priority') { av = PRIORITIES.indexOf(a.priority); bv = PRIORITIES.indexOf(b.priority); }
      else if (key === 'status') { av = STATii.indexOf(a.status); bv = STATii.indexOf(b.status); }
      else if (key === 'created') { av = a.createdAt; bv = b.createdAt; }
      else { av = a.updatedAt || ''; bv = b.updatedAt || ''; }
      if (av < bv) return dir === 'desc' ? 1 : -1;
      if (av > bv) return dir === 'desc' ? -1 : 1;
      return 0;
    });
    return list;
  };

  P.setViewState = function (patch) {
    Object.assign(viewState, patch);
  };
  P.getViewState = function () { return viewState; };

  /* Apply settings defaults on first render (or if user never toggled). */
  function applyDefaultsOnce() {
    if (P._defApplied) return;
    P._defApplied = true;
    var s = MTA.state.settings && MTA.state.settings.projects;
    if (!s) return;
    if (s.view === 'grid' || s.view === 'list') viewState.view = s.view;
    if (s.sort) viewState.sort = s.sort;
  }

  /* ---------- Status badge helper ---------- */
  function statusBadge(s) {
    var slug = (s || '').toLowerCase().replace(/\s+/g, '-');
    return '<span class="badge b-' + slug + '"><span class="b-dot"></span>' + U.esc(s) + '</span>';
  }
  function priorityBadge(s) {
    var slug = (s || '').toLowerCase();
    return '<span class="badge b-' + slug + '">' + U.esc(s) + '</span>';
  }

  function deadlineHtml(p) {
    if (!p.deadline) return '<span class="pj-deadline-line muted"><svg class="ic ic-sm" aria-hidden="true"><use href="#ic-clock"></use></svg>No deadline</span>';
    var dl = U.deadlineLabel(p.deadline);
    return '<span class="pj-deadline-line ' + dl.cls + '"><svg class="ic ic-sm" aria-hidden="true"><use href="#ic-clock"></use></svg>' + dl.text + '</span>';
  }

  /* ---------- Card + row renderers ---------- */
  function renderCard(p) {
    var tags = (p.tags || []).slice(0, 3).map(function (t) {
      return '<span class="chip tag">' + U.esc(t) + '</span>';
    }).join('');
    return '<div class="card hoverable pj-card has-focus" data-id="' + p.id + '" tabindex="0" role="button" aria-label="Open project ' + U.esc(p.name) + '">' +
      '<div class="pj-top">' +
        '<div class="pj-name">' + U.esc(p.name) + '</div>' +
        '<div class="card-act">' +
          '<button class="icon-btn btn-sm js-edit" data-id="' + p.id + '" title="Edit" aria-label="Edit">' + U.icon('ic-edit') + '</button>' +
          '<button class="icon-btn btn-sm js-delete" data-id="' + p.id + '" title="Delete" aria-label="Delete" data-del>' + U.icon('ic-trash') + '</button>' +
        '</div>' +
        '<button class="fav-btn ' + (p.favorite ? 'on' : '') + '" data-fav="' + p.id + '" title="Favorite" aria-label="Toggle favorite">' +
          U.icon('ic-star') + '</button>' +
      '</div>' +
      '<div class="row wrap">' + statusBadge(p.status) + priorityBadge(p.priority) + '</div>' +
      '<div class="pj-desc">' + U.esc(p.description || 'No description yet') + '</div>' +
      (tags ? '<div class="pj-tags">' + tags + '</div>' : '') +
      '<div class="pj-foot">' +
        '<div class="progress" role="progressbar" aria-valuenow="' + (+p.progress || 0) + '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + (+p.progress || 0) + '%"></span></div>' +
        '<span class="mono tiny">' + (+p.progress || 0) + '%</span>' +
        deadlineHtml(p) +
      '</div>' +
    '</div>';
  }

  function renderRow(p) {
    return '<div class="pj-row" data-id="' + p.id + '" tabindex="0" role="button" aria-label="Open project ' + U.esc(p.name) + '">' +
      '<span class="fav-btn ' + (p.favorite ? 'on' : '') + '" data-fav="' + p.id + '" title="Favorite">' + U.icon('ic-star') + '</span>' +
      '<div class="grow"><div class="pj-row-name">' + U.esc(p.name) + '</div>' +
        '<div class="pj-mini">' + U.esc(p.category || 'Uncategorized') + ' &middot; ' + U.esc(p.status || '') + '</div></div>' +
      '<span class="pj-mini">' + U.esc(p.priority || '') + '</span>' +
      '<div class="pj-row-progress"><div class="progress"><span style="width:' + (+p.progress || 0) + '%"></span></div></div>' +
      '<span class="pj-mini mono">' + (+p.progress || 0) + '%</span>' +
      deadlineHtml(p) +
      '<div class="card-act">' +
        '<button class="icon-btn btn-sm js-edit" data-id="' + p.id + '" title="Edit">' + U.icon('ic-edit') + '</button>' +
        '<button class="icon-btn btn-sm js-delete" data-id="' + p.id + '" data-del title="Delete">' + U.icon('ic-trash') + '</button>' +
      '</div>' +
    '</div>';
  }

  /* ---------- Form ---------- */
  function optionHtml(list, sel) {
    return list.map(function (v) {
      return '<option value="' + U.esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + U.esc(v) + '</option>';
    }).join('');
  }

  function openForm(project) {
    var editing = !!project;
    var body = U.el('div', {});
    body.innerHTML =
      '<form id="pj-form" class="form-grid">' +
        '<div class="field span2"><label class="field-label" for="pj-name">Name <span class="req">*</span></label>' +
          '<input class="input" id="pj-name" required value="' + U.esc((project && project.name) || '') + '" placeholder="Project name"></div>' +
        '<div class="field span2"><label class="field-label" for="pj-desc">Description</label>' +
          '<textarea class="textarea" id="pj-desc" rows="3" placeholder="What is this project about?">' + U.esc((project && project.description) || '') + '</textarea></div>' +
        '<div class="field span2"><label class="field-label" for="pj-tags">Tags</label>' +
          '<input class="input" id="pj-tags" value="' + U.esc(((project && project.tags) || []).join(', ')) + '" placeholder="dashboard, javascript, local-first"></div>' +
        '<div class="field"><label class="field-label" for="pj-cat">Category</label>' +
          '<input class="input" id="pj-cat" list="pj-cat-list" value="' + U.esc((project && project.category) || '') + '" placeholder="Web App">' +
          '<datalist id="pj-cat-list">' + optionHtml(P.categories(P.list()), '') + '</datalist></div>' +
        '<div class="field"><label class="field-label" for="pj-status">Status</label>' +
          '<select class="select" id="pj-status">' + optionHtml(STATii, (project && project.status) || 'Planning') + '</select></div>' +
        '<div class="field"><label class="field-label" for="pj-priority">Priority</label>' +
          '<select class="select" id="pj-priority">' + optionHtml(PRIORITIES, (project && project.priority) || 'Medium') + '</select></div>' +
        '<div class="field"><label class="field-label" for="pj-progress">Progress: <b id="pj-progress-lbl">' + ((project && project.progress) || 0) + '%</b></label>' +
          '<input class="input" type="range" id="pj-progress" min="0" max="100" step="5" value="' + ((project && project.progress) || 0) + '"></div>' +
        '<div class="field"><label class="field-label" for="pj-start">Start date</label>' +
          '<input class="input" type="date" id="pj-start" value="' + U.esc((project && project.startDate) || '') + '"></div>' +
        '<div class="field"><label class="field-label" for="pj-deadline">Deadline</label>' +
          '<input class="input" type="date" id="pj-deadline" value="' + U.esc((project && project.deadline) || '') + '"></div>' +
        '<div class="field"><label class="field-label" for="pj-repo">Repository URL</label>' +
          '<input class="input" id="pj-repo" type="url" value="' + U.esc((project && project.repoUrl) || '') + '" placeholder="https://github.com/..."></div>' +
        '<div class="field"><label class="field-label" for="pj-live">Live URL</label>' +
          '<input class="input" id="pj-live" type="url" value="' + U.esc((project && project.liveUrl) || '') + '" placeholder="https://..."></div>' +
        '<div class="field"><label class="field-label" for="pj-path">Local path</label>' +
          '<input class="input" id="pj-path" value="' + U.esc((project && project.localPath) || '') + '" placeholder="E:/Projects/..."></div>' +
        '<div class="field"><label class="field-label" for="pj-fav">Favorite</label>' +
          '<div class="row" style="margin-top:6px"><label class="switch"><input type="checkbox" id="pj-fav"' + (project && project.favorite ? ' checked' : '') + '><span>Star this project</span></label></div></div>' +
        '<div class="field span2"><label class="field-label" for="pj-notes">Notes</label>' +
          '<textarea class="textarea" id="pj-notes" rows="3" placeholder="Internal notes...">' + U.esc((project && project.notes) || '') + '</textarea></div>' +
      '</form>';

    MTA.modal.open({
      title: editing ? 'Edit project' : 'New project',
      size: 'lg',
      body: body,
      actions: [
        { label: 'Cancel', cls: 'btn-ghost' },
        {
          label: editing ? 'Save changes' : 'Create project', cls: 'btn-primary',
          click: function (api) {
            var form = U.$('#pj-form', body);
            if (!form.reportValidity()) return false;
            var name = U.$('#pj-name', body).value.trim();
            if (!name) return false;
            var tagsInput = U.$('#pj-tags', body);
            var tagsArr = tagsInput
              ? tagsInput.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean)
              : (project && project.tags) || [];
            var data = {
              name: name,
              description: U.$('#pj-desc', body).value.trim(),
              category: U.$('#pj-cat', body).value.trim(),
              status: U.$('#pj-status', body).value,
              priority: U.$('#pj-priority', body).value,
              progress: +U.$('#pj-progress', body).value,
              startDate: U.$('#pj-start', body).value,
              deadline: U.$('#pj-deadline', body).value,
              repoUrl: U.$('#pj-repo', body).value.trim(),
              liveUrl: U.$('#pj-live', body).value.trim(),
              localPath: U.$('#pj-path', body).value.trim(),
              notes: U.$('#pj-notes', body).value.trim(),
              favorite: U.$('#pj-fav', body).checked,
              tags: tagsArr
            };
            if (editing) {
              P.update(project.id, data);
              MTA.toast('Project updated', 'success');
            } else {
              P.create(data);
              MTA.toast('Project created', 'success');
            }
            P.renderSurface();
            return true;
          }
        }
      ],
      onMount: function () {
        U.$('#pj-name', body).focus();
        var input = U.$('#pj-progress', body);
        input.addEventListener('input', function () {
          U.$('#pj-progress-lbl', body).textContent = input.value + '%';
        });
      }
    });
  }

  /* ---------- Render page ---------- */
  P.renderSurface = function () {
    var main = document.getElementById('app-main');
    P.render(main);
  };

  P.render = function (main) {
    applyDefaultsOnce();
    var cats = P.categories(P.list());
    var list = P.filtered();

    var statusOpts = '<option value="All">All statuses</option>' + optionHtml(STATii, viewState.status);
    var prioOpts = '<option value="All">All priorities</option>' + optionHtml(PRIORITIES, viewState.priority);
    var catOpts = '<option value="All">All categories</option>' + optionHtml(cats, viewState.category);
    var sortOpts = [
      ['updated_desc', 'Recently updated'], ['created_desc', 'Newest first'], ['name_asc', 'Name A-Z'],
      ['name_desc', 'Name Z-A'], ['progress_desc', 'Most progress'], ['progress_asc', 'Least progress'],
      ['deadline_asc', 'Earliest deadline'], ['priority_desc', 'Priority']
    ].map(function (s) {
      return '<option value="' + s[0] + '"' + (viewState.sort === s[0] ? ' selected' : '') + '>' + s[1] + '</option>';
    }).join('');

    var html =
      '<div class="page" data-page="projects">' +
      '<div class="page-head"><div><h2>Projects</h2>' +
      '<div class="sub">' + list.length + ' shown &middot; ' + P.list().length + ' total</div></div>' +
      '<div class="page-head-actions">' +
        '<div class="seg" role="group" aria-label="View mode">' +
          '<button id="pv-grid" class="' + (viewState.view === 'grid' ? 'active' : '') + '">' + U.icon('ic-grid') + ' Grid</button>' +
          '<button id="pv-list" class="' + (viewState.view !== 'grid' ? 'active' : '') + '">' + U.icon('ic-list') + ' List</button>' +
        '</div>' +
        '<button class="btn btn-primary" id="pj-new">' + U.icon('ic-plus') + ' New project</button>' +
      '</div></div>' +

      '<div class="toolbar">' +
        '<div class="searchbox"><svg class="ic-sb" aria-hidden="true"><use href="#ic-search"></use></svg>' +
          '<input class="input" id="pj-q" value="' + U.esc(viewState.q) + '" placeholder="Search projects..." aria-label="Search projects">' +
          '<button class="clear-btn" id="pj-clear" aria-label="Clear search">' + U.icon('ic-close') + '</button></div>' +
        '<select class="select" id="pj-status-f" style="width:140px" aria-label="Filter by status">' + statusOpts + '</select>' +
        '<select class="select" id="pj-prio-f" style="width:130px" aria-label="Filter by priority">' + prioOpts + '</select>' +
        '<select class="select" id="pj-cat-f" style="width:150px" aria-label="Filter by category">' + catOpts + '</select>' +
        '<label class="ck" style="flex:none"><input type="checkbox" id="pj-fav-f"' + (viewState.favOnly ? ' checked' : '') + '><span>Favorites</span></label>' +
        '<div class="spacer"></div>' +
        '<select class="select" id="pj-sort" style="width:170px" aria-label="Sort projects">' + sortOpts + '</select>' +
      '</div>' +
      '<div id="pj-body"></div></div>';

    main.innerHTML = html;
    var body = U.$('#pj-body', main);

    /* draw list */
    function drawList() {
      if (!list.length) {
        var filtered = viewState.q || viewState.status !== 'All' || viewState.priority !== 'All' || viewState.category !== 'All' || viewState.favOnly;
        body.innerHTML = '<div class="card"><div class="empty"><div class="empty-ic">' + U.icon('ic-folder') +
          '</div><h3>' + (filtered ? 'No projects match your filters' : 'No projects yet') + '</h3><p>' +
          (filtered ? 'Try a different search or clear the filters.' : 'Create your first project to start tracking work.') + '</p>' +
          '<div class="empty-actions">' +
          (filtered
            ? '<button class="btn btn-ghost" data-reset-filters>' + U.icon('ic-refresh') + ' Clear filters</button>'
            : '<button class="btn btn-primary" data-new>' + U.icon('ic-plus') + ' New project</button>') +
          '</div></div></div>';
        return;
      }
      body.innerHTML = viewState.view === 'grid'
        ? '<div class="pj-grid">' + list.map(renderCard).join('') + '</div>'
        : '<div class="pj-list">' + list.map(renderRow).join('') + '</div>';
    }
    drawList();

    /* events */
    U.$('#pj-new', main).addEventListener('click', function () { openForm(null); });
    U.$('#pv-grid', main).addEventListener('click', function () { viewState.view = 'grid'; P.render(main); });
    U.$('#pv-list', main).addEventListener('click', function () { viewState.view = 'list'; P.render(main); });

    var q = U.$('#pj-q', main);
    q.addEventListener('input', U.debounce(function () {
      viewState.q = q.value.trim();
      P.render(main);
    }, 200));
    U.$('#pj-clear', main).addEventListener('click', function () { viewState.q = ''; P.render(main); });
    U.$('#pj-status-f', main).addEventListener('change', function () { viewState.status = this.value; P.render(main); });
    U.$('#pj-prio-f', main).addEventListener('change', function () { viewState.priority = this.value; P.render(main); });
    U.$('#pj-cat-f', main).addEventListener('change', function () { viewState.category = this.value; P.render(main); });
    U.$('#pj-fav-f', main).addEventListener('change', function () { viewState.favOnly = this.checked; P.render(main); });
    U.$('#pj-sort', main).addEventListener('change', function () { viewState.sort = this.value; P.render(main); });

    var resetBtn = body.querySelector('[data-reset-filters]');
    if (resetBtn) resetBtn.addEventListener('click', function () {
      viewState.q = ''; viewState.status = 'All'; viewState.priority = 'All';
      viewState.category = 'All'; viewState.favOnly = false;
      P.render(main);
    });

    /* card/row clicks + buttons */
    body.addEventListener('click', function (e) {
      var fav = e.target.closest('[data-fav]');
      if (fav) {
        e.stopPropagation();
        P.toggleFavorite(fav.dataset.fav);
        P.render(main);
        return;
      }
      var del = e.target.closest('[data-del]');
      if (del) {
        e.stopPropagation();
        var p = P.get(del.dataset.id);
        MTA.modal.confirm({
          title: 'Delete project',
          message: 'Delete "' + (p ? p.name : '') + '"? This only removes it from the dashboard — your real files are never touched.',
          danger: true, confirmLabel: 'Delete'
        }).then(function (ok) {
          if (ok) {
            P.remove(del.dataset.id);
            MTA.toast('Project deleted', 'warning', 'Deleted');
            P.render(main);
          }
        });
        return;
      }
      var edit = e.target.closest('.js-edit');
      if (edit) {
        e.stopPropagation();
        openForm(P.get(edit.dataset.id));
        return;
      }
      var card = e.target.closest('[data-id]');
      if (card) openDetails(card.dataset.id);
    });

    body.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.hasAttribute && e.target.hasAttribute('data-id') && !e.target.closest('button')) {
        openDetails(e.target.dataset.id);
      }
    });

    };

  /* ---------- Details drawer ---------- */
  function openDetails(id) {
    var p = P.get(id);
    if (!p) return;
    var tags = (p.tags || []).map(function (t) { return '<span class="chip tag">' + U.esc(t) + '</span>'; }).join('');
    var body = U.el('div', {});
    body.innerHTML =
      '<div class="row wrap" style="margin-bottom:12px">' + statusBadge(p.status) + priorityBadge(p.priority) +
      (p.favorite ? '<span class="badge" style="background:var(--warning-soft);color:var(--warning-text)"><span class="b-dot"></span>Favorite</span>' : '') + '</div>' +
      (p.description ? '<p class="small" style="color:var(--text-2)">' + U.esc(p.description) + '</p>' : '') +
      (tags ? '<div class="row wrap" style="margin-bottom:12px">' + tags + '</div>' : '') +
      '<div class="detail-grid">' +
        '<div class="detail-item"><div class="k">Category</div><div class="v">' + U.esc(p.category || '—') + '</div></div>' +
        '<div class="detail-item"><div class="k">Progress</div><div class="v">' + (+p.progress || 0) + '%</div></div>' +
        '<div class="detail-item"><div class="k">Start date</div><div class="v">' + (p.startDate ? U.fmtDate(p.startDate) : '—') + '</div></div>' +
        '<div class="detail-item"><div class="k">Deadline</div><div class="v">' + (p.deadline ? U.fmtDate(p.deadline) : '—') + '</div></div>' +
        '<div class="detail-item"><div class="k">Created</div><div class="v">' + U.fmtDate(p.createdAt) + '</div></div>' +
        '<div class="detail-item"><div class="k">Updated</div><div class="v">' + U.timeAgo(p.updatedAt) + '</div></div>' +
      '</div>' +
      '<div style="height:1px;background:var(--border);margin:12px 0"></div>' +
      '<div class="detail-grid">' +
        (p.repoUrl ? '<div class="detail-item"><div class="k">Repository</div><div class="v"><a href="' + U.esc(p.repoUrl) + '" target="_blank" rel="noopener">' + U.esc(p.repoUrl) + '</a></div></div>' : '') +
        (p.liveUrl ? '<div class="detail-item"><div class="k">Live URL</div><div class="v"><a href="' + U.esc(p.liveUrl) + '" target="_blank" rel="noopener">' + U.esc(p.liveUrl) + '</a></div></div>' : '') +
        (p.localPath ? '<div class="detail-item"><div class="k">Local path</div><div class="v mono">' + U.esc(p.localPath) + '</div></div>' : '') +
      '</div>' +
      (p.notes ? '<div style="height:1px;background:var(--border);margin:12px 0"></div><div class="k" style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-3);font-weight:650">Notes</div><p class="small">' + U.esc(p.notes) + '</p>' : '');

    var drawer = MTA.modal.drawer({
      title: p.name,
      body: body,
      footer: '<button class="btn" id="pj-d-edit">' + U.icon('ic-edit') + ' Edit</button>' +
        '<button class="btn btn-danger" id="pj-d-del">' + U.icon('ic-trash') + ' Delete</button>',
      onMount: function (d) {
        U.$('#pj-d-edit', d.body).addEventListener('click', function () {
          d.close();
          openForm(P.get(id));
        });
        U.$('#pj-d-del', d.body).addEventListener('click', function () {
          d.close();
          MTA.modal.confirm({
            title: 'Delete project',
            message: 'Delete "' + p.name + '"? This only removes it from the dashboard — your real files are never touched.',
            danger: true, confirmLabel: 'Delete'
          }).then(function (ok) {
            if (ok) { P.remove(id); MTA.toast('Project deleted', 'warning', 'Deleted'); P.renderSurface(); }
          });
        });
      }
    });
  }

  MTA.projects = P;
  P._openDetails = openDetails;
})(typeof window !== 'undefined' ? window : this);