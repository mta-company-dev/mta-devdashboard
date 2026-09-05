/* ============================================================
   MTA DevDashboard - modules/devnote.js
   Local developer note system with autosave + rich editor.
   ============================================================ */
(function (global) {
  'use strict';
  var MTA = (global.MTA = global.MTA || {});
  var U = MTA.utils;
  var D = {};

  var CATEGORIES = ['General', 'DevOps', 'Design', 'Back-end', 'Front-end', 'Research', 'Meetings', 'Personal'];
  var viewState = { q: '', category: 'All', onlyFav: false, onlyPinned: false };

  D.list = function () { return MTA.store.notes(); };
  D.get = function (id) {
    return MTA.store.notes().find(function (n) { return n.id === id; }) || null;
  };

  D.save = function (note) {
    var notes = D.list();
    var idx = notes.findIndex(function (n) { return n.id === note.id; });
    if (idx < 0) notes.unshift(note); else notes[idx] = note;
    MTA.store.saveNotes(notes);
    MTA.state.bump('notes');
  };

  D.create = function (data) {
    var now = new Date().toISOString();
    var note = Object.assign({
      id: U.uid('nt'), title: 'Untitled note', subtitle: '',
      category: 'General', tags: [], content: '<p><br></p>',
      pinned: false, favorite: false, createdAt: now, updatedAt: now
    }, data || {});
    if (!note.id) note.id = U.uid('nt');
    var notes = D.list();
    notes.unshift(note);
    MTA.store.saveNotes(notes);
    MTA.activity.track('note_create', 'Created note ' + note.title, { entityType: 'note', entityId: note.id });
    MTA.state.bump('notes');
    return note;
  };

  D.update = function (id, patch) {
    var n = D.get(id);
    if (!n) return null;
    var updated = Object.assign({}, n, patch, { updatedAt: new Date().toISOString() });
    D.save(updated);
    return updated;
  };

  D.remove = function (id) {
    var n = D.get(id);
    var notes = D.list().filter(function (x) { return x.id !== id; });
    MTA.store.saveNotes(notes);
    if (n) MTA.activity.track('note_delete', 'Deleted note ' + n.title, { entityType: 'note', entityId: id });
    MTA.state.bump('notes');
  };

  D.duplicate = function (id) {
    var n = D.get(id);
    if (!n) return null;
    var now = new Date().toISOString();
    var copy = Object.assign({}, n, {
      id: U.uid('nt'), title: n.title + ' (copy)', pinned: false,
      createdAt: now, updatedAt: now
    });
    D.save(copy);
    MTA.state.bump('notes');
    return copy;
  };

  D.togglePin = function (id) {
    var n = D.get(id); if (!n) return;
    D.update(id, { pinned: !n.pinned });
  };
  D.toggleFav = function (id) {
    var n = D.get(id); if (!n) return;
    D.update(id, { favorite: !n.favorite });
  };

  /* ---------- Filtering ---------- */
  D.filtered = function () {
    var list = D.list();
    var q = viewState.q.toLowerCase();
    if (q) {
      list = list.filter(function (n) {
        return (n.title || '').toLowerCase().indexOf(q) >= 0 ||
          (n.subtitle || '').toLowerCase().indexOf(q) >= 0 ||
          U.stripHtml(n.content).toLowerCase().indexOf(q) >= 0 ||
          (n.tags || []).join(' ').toLowerCase().indexOf(q) >= 0;
      });
    }
    if (viewState.category !== 'All') list = list.filter(function (n) { return n.category === viewState.category; });
    if (viewState.onlyFav) list = list.filter(function (n) { return n.favorite; });
    if (viewState.onlyPinned) list = list.filter(function (n) { return n.pinned; });
    /* pinned first, then updated desc */
    list.sort(function (a, b) {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
    return list;
  };

  D.categories = function () {
    var found = {};
    D.list().forEach(function (n) { if (n.category) found[n.category] = true; });
    var merged = CATEGORIES.slice();
    Object.keys(found).forEach(function (c) { if (merged.indexOf(c) < 0) merged.push(c); });
    return merged;
  };

  /* ---------- Excerpt ---------- */
  function excerpt(n) {
    var txt = U.stripHtml(n.content || '').trim();
    return U.truncate(txt, 110) || 'Empty note';
  }

  /* ---------- Render ---------- */
  var currentEditor = null;
  var autosaveTimer = null;

  D.render = function (main) {
    var notes = D.filtered();
    var noteItems = notes.map(function (n) {
      var tags = (n.tags || []).slice(0, 2).map(function (t) {
        return '<button class="chip tag js-tag" data-q="' + U.esc(t) + '">' + U.esc(t) + '</button>';
      }).join('');
      return '<div class="note-item' + (currentEditor && currentEditor.noteId === n.id ? ' active' : '') +
        '" data-id="' + n.id + '" tabindex="0" role="button">' +
        '<div class="ni-title">' +
          (n.pinned ? '<svg class="ic note-pin" aria-hidden="true"><use href="#ic-pin"></use></svg>' : '') +
          (n.favorite ? '<svg class="ic note-fav" aria-hidden="true"><use href="#ic-star"></use></svg>' : '') +
          '<span class="ellipsis">' + U.esc(n.title || 'Untitled') + '</span></div>' +
        '<div class="ni-excerpt">' + excerpt(n) + '</div>' +
        '<div class="ni-meta"><span class="chip">' + U.esc(n.category || 'General') + '</span>' +
          '<span>' + U.timeAgo(n.updatedAt) + '</span></div>' +
        (tags ? '<div class="row wrap" style="margin-top:6px">' + tags + '</div>' : '') +
      '</div>';
    }).join('');

    var cats = D.categories();
    var catOpts = cats.map(function (c) {
      return '<option value="' + U.esc(c) + '"' + (viewState.category === c ? ' selected' : '') + '>' + U.esc(c) + '</option>';
    }).join('');

    var html =
      '<div class="page" data-page="devnote">' +
      '<div class="page-head"><div><h2>DevNote</h2>' +
      '<div class="sub">' + notes.length + ' notes</div></div>' +
      '<div class="page-head-actions">' +
        '<button class="btn" id="dn-new">' + U.icon('ic-plus') + ' New note</button></div></div>' +

      '<div class="toolbar" style="margin-bottom:var(--sp-4)">' +
        '<div class="searchbox"><svg class="ic-sb" aria-hidden="true"><use href="#ic-search"></use></svg>' +
          '<input class="input" id="dn-q" value="' + U.esc(viewState.q) + '" placeholder="Search notes..." aria-label="Search notes"></div>' +
        '<select class="select" id="dn-cat" style="width:150px" aria-label="Filter by category">' +
          '<option value="All">All categories</option>' + catOpts + '</select>' +
        '<button class="btn btn-sm ' + (viewState.onlyFav ? 'btn-primary' : '') + '" id="dn-fav">' + U.icon('ic-star') + ' Favorites</button>' +
        '<button class="btn btn-sm ' + (viewState.onlyPinned ? 'btn-primary' : '') + '" id="dn-pin">' + U.icon('ic-pin') + ' Pinned</button>' +
      '</div>' +

      '<div class="notes-layout">' +
        '<div class="notes-list">' +
          '<div class="nl-filter" style="padding:var(--sp-2);border-bottom:1px solid var(--border)"><div class="seg" style="width:100%">' +
            '<button style="flex:1" class="' + (!viewState.onlyFav && !viewState.onlyPinned ? 'active' : '') + '" data-nf="all">All</button>' +
            '<button style="flex:1" class="' + (viewState.onlyFav ? 'active' : '') + '" data-nf="fav">Favs</button>' +
            '<button style="flex:1" class="' + (viewState.onlyPinned ? 'active' : '') + '" data-nf="pin">Pinned</button>' +
          '</div></div>' +
          '<div class="notes-scroll">' +
            (notes.length
              ? noteItems
              : '<div class="empty"><div class="empty-ic">' + U.icon('ic-note') + '</div><h3>No notes</h3><p>Create your first note to get started.</p></div>') +
          '</div>' +
        '</div>' +
        '<div class="note-editor-panel" id="dn-editor-panel"></div>' +
      '</div></div>';

    main.innerHTML = html;
    var panel = U.$('#dn-editor-panel', main);

    bindMain(main);

    var q = U.$('#dn-q', main);
    q.addEventListener('input', U.debounce(function () { viewState.q = q.value.trim(); D.render(main); }, 220));
    U.$('#dn-cat', main).addEventListener('change', function () { viewState.category = this.value; D.render(main); });

    if (currentEditor && currentEditor.noteId) {
      attachEditor(D.get(currentEditor.noteId));
    } else {
      showEmptyEditor(panel);
    }
  };

  /* ---------- Module-scope actions + single main click binding ---------- */
  function showEmptyEditor(panel) {
    panel.innerHTML = '<div class="note-empty-editor"><div class="empty"><div class="empty-ic">' + U.icon('ic-note') +
      '</div><h3>Select a note</h3><p>Pick a note from the list or create a new one.</p>' +
      '<div class="empty-actions"><button class="btn btn-primary" data-new-note>' + U.icon('ic-plus') + ' New note</button></div></div></div>';
    var nb = panel.querySelector('[data-new-note]');
    if (nb) nb.addEventListener('click', function () { newNote(); });
    currentEditor = null;
  }

  function mainEl() { return document.getElementById('app-main'); }

  function newNote() {
    var note = D.create({ title: '', content: '<p><br></p>' });
    D.render(mainEl());
    openEditor(note.id);
  }

  function openEditor(id) {
    D.render(mainEl());
    if (D.get(id)) attachEditor(D.get(id));
  }

  function bindMain(main) {
    if (D._bound) return;
    D._bound = true;
    main.addEventListener('click', function (e) {
      if (e.target.closest('#dn-new')) { newNote(); return; }
      var item = e.target.closest('.note-item');
      if (item) { openEditor(item.dataset.id); return; }
      if (e.target.closest('#dn-fav')) { viewState.onlyFav = !viewState.onlyFav; viewState.onlyPinned = false; D.render(main); return; }
      if (e.target.closest('#dn-pin')) { viewState.onlyPinned = !viewState.onlyPinned; viewState.onlyFav = false; D.render(main); return; }
      var nf = e.target.closest('[data-nf]');
      if (nf) {
        viewState.onlyFav = nf.dataset.nf === 'fav';
        viewState.onlyPinned = nf.dataset.nf === 'pin';
        D.render(main);
        return;
      }
      if (e.target.closest('.js-tag')) { viewState.q = e.target.closest('.js-tag').dataset.q; D.render(main); return; }
      var dupBtn = e.target.closest('[data-dup]');
      if (dupBtn) {
        var dup = D.duplicate(dupBtn.dataset.dup);
        MTA.toast('Note duplicated', 'success');
        D.render(main);
        if (dup) openEditor(dup.id);
        return;
      }
      var delBtn = e.target.closest('[data-del-note]');
      if (delBtn) {
        var delId = delBtn.dataset.delNote;
        MTA.modal.confirm({ title: 'Delete note', message: 'Delete this note? This cannot be undone.', danger: true, confirmLabel: 'Delete' })
          .then(function (ok) {
            if (!ok) return;
            D.remove(delId);
            MTA.toast('Note deleted', 'warning', 'Deleted');
            D.render(main);
          });
        return;
      }
    });
  }

  /* ---------- Editor attach ---------- */
  function attachEditor(note) {
    var panel = U.$('#dn-editor-panel');
    if (!panel || !note) return;
    var autosaveSec = (MTA.state.settings && MTA.state.settings.devnote && MTA.state.settings.devnote.autosave) || 5;
    var autosaveMs = Math.max(2, autosaveSec) * 1000;

    panel.innerHTML =
      '<div class="note-meta-bar">' +
        '<span class="autosave-dot" id="dn-dot"></span>' +
        '<span id="dn-status">Ready</span>' +
        '<span class="grow"></span>' +
        '<span id="dn-last-edited">Saved ' + U.timeAgo(note.updatedAt) + '</span>' +
      '</div>' +
      '<div class="note-fields">' +
        '<input class="note-title-input" id="dn-title" placeholder="Note title..." aria-label="Note title" value="' + U.esc(note.title || '') + '">' +
        '<input class="note-sub-input" id="dn-sub" placeholder="Subtitle (optional)" aria-label="Note subtitle" value="' + U.esc(note.subtitle || '') + '">' +
      '</div>' +
      '<div class="note-extras">' +
        '<select class="select" id="dn-cat-e" style="width:150px" aria-label="Category">' +
          D.categories().map(function (c) {
            return '<option value="' + U.esc(c) + '"' + (note.category === c ? ' selected' : '') + '>' + U.esc(c) + '</option>';
          }).join('') +
        '</select>' +
        '<button class="btn btn-sm ' + (note.pinned ? 'btn-primary' : '') + '" data-pin-t="' + note.id + '">' + U.icon('ic-pin') + ' Pin</button>' +
        '<button class="btn btn-sm ' + (note.favorite ? 'btn-primary' : '') + '" data-fav-t="' + note.id + '">' + U.icon('ic-star') + '</button>' +
        '<button class="btn btn-sm" data-dup="' + note.id + '">' + U.icon('ic-copy') + ' Duplicate</button>' +
        '<button class="btn btn-sm btn-danger" data-del-note="' + note.id + '">' + U.icon('ic-trash') + ' Delete</button>' +
      '</div>' +
      '<div id="dn-editor-slot" style="flex:1;display:flex;flex-direction:column;min-height:0"></div>';

    var slot = U.$('#dn-editor-slot', panel);
    var editor = MTA.editor.create({ container: slot, id: 'note-editor' });
    editor.setData(note);

    currentEditor = { noteId: note.id, editor: editor, dirty: false };

    function markDirty() {
      currentEditor.dirty = true;
      var dot = U.$('#dn-dot', panel);
      var status = U.$('#dn-status', panel);
      if (dot) dot.style.background = 'var(--warning)';
      if (status) status.textContent = 'Unsaved changes...';
    }

    function pushSave() {
      if (!currentEditor || !currentEditor.dirty) return;
      var data = editor.getData();
      var catSel = U.$('#dn-cat-e', panel);
      D.update(note.id, {
        title: data.title || 'Untitled note',
        subtitle: data.subtitle,
        content: data.content || '<p><br></p>',
        category: catSel ? catSel.value : note.category
      });
      currentEditor.dirty = false;
      MTA.activity.track('note_edit', 'Edited note ' + (data.title || note.title), { entityType: 'note', entityId: note.id });
      var dot = U.$('#dn-dot', panel);
      var status = U.$('#dn-status', panel);
      var last = U.$('#dn-last-edited', panel);
      if (dot) dot.style.background = '';
      if (status) status.textContent = 'Saved at ' + U.fmtTime(new Date());
      if (last) last.textContent = 'Saved ' + U.timeAgo(new Date());
    }

    var debouncedSave = U.debounce(pushSave, autosaveMs);
    editor.title.addEventListener('input', function () { markDirty(); debouncedSave(); });
    editor.subtitle.addEventListener('input', function () { markDirty(); debouncedSave(); });
    editor.rte.addEventListener('input', function () { markDirty(); debouncedSave(); });
    var catEl = U.$('#dn-cat-e', panel);
    if (catEl) catEl.addEventListener('change', function () {
      D.update(note.id, { category: catEl.value });
      markDirty(); debouncedSave();
    });

    /* click handlers re-bound via main delegate; save before re-render */
    ['[data-pin-t]', '[data-fav-t]', '[data-del-note]', '[data-dup]'].forEach(function (sel) {
      var el = panel.querySelector(sel);
      if (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          pushSave();
        });
      }
    });

    editor.rte.addEventListener('paste', function (e) {
      /* keep formatting, strip nothing - plain paste protection for scripts */
      requestAnimationFrame(function () {
        var anchors = editor.rte.querySelectorAll('script, iframe');
        anchors.forEach(function (a) { a.parentNode && a.parentNode.removeChild(a); });
      });
    });
  }

  MTA.devnote = D;
  D._open = function (id) {
    var main = document.getElementById('app-main');
    if (main) {
      D.render(main);
      attachEditor(D.get(id));
    }
  };
  D._saveNow = function () {
    /* used by Ctrl+S shortcut */
    if (currentEditor && currentEditor.dirty) {
      var note = D.get(currentEditor.noteId);
      if (note) {
        var data = currentEditor.editor.getData();
        var catSel = document.querySelector('#dn-cat-e');
        D.update(note.id, {
          title: data.title || 'Untitled note',
          subtitle: data.subtitle,
          content: data.content || '<p><br></p>',
          category: catSel ? catSel.value : note.category
        });
        currentEditor.dirty = false;
      }
    }
  };
})(typeof window !== 'undefined' ? window : this);