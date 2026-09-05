/* ============================================================
   MTA DevDashboard - modules/settings.js
   Profile, Appearance, per-module preferences, shortcuts,
   storage (export/import/clear), security, advanced.
   ============================================================ */
(function (global) {
  'use strict';
  var MTA = (global.MTA = global.MTA || {});
  var U = MTA.utils;
  var S = {};

  var currentSection = 'profile';

  var SECTIONS = [
    { id: 'profile', label: 'Profile', icon: 'ic-user', group: 'General' },
    { id: 'appearance', label: 'Appearance', icon: 'ic-palette', group: 'General' },
    { id: 'dashboard', label: 'Dashboard', icon: 'ic-dashboard', group: 'General' },
    { id: 'projects', label: 'Projects', icon: 'ic-folder', group: 'Modules' },
    { id: 'tasks', label: 'Tasks', icon: 'ic-tasks', group: 'Modules' },
    { id: 'devnote', label: 'DevNote', icon: 'ic-note', group: 'Modules' },
    { id: 'calendar', label: 'Calendar', icon: 'ic-calendar', group: 'Modules' },
    { id: 'notifications', label: 'Notifications', icon: 'ic-alert', group: 'General' },
    { id: 'shortcuts', label: 'Keyboard shortcuts', icon: 'ic-keyboard', group: 'General' },
    { id: 'storage', label: 'Storage', icon: 'ic-db', group: 'Data' },
    { id: 'security', label: 'Security', icon: 'ic-lock', group: 'Data' },
    { id: 'advanced', label: 'Advanced', icon: 'ic-terminal', group: 'Data' }
  ];

  /* ---------- Helpers ---------- */
  function switchRow(label, desc, id, checked, onchange) {
    var row = U.el('div', { class: 'settings-row' });
    row.innerHTML = '<div><div class="sr-label">' + label + '</div>' +
      (desc ? '<div class="sr-desc">' + desc + '</div>' : '') + '</div>' +
      '<div class="sr-control"><label class="switch"><input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '><span></span></label></div>';
    var cb = U.$('#' + id, row);
    cb.addEventListener('change', onchange);
    return row;
  }

  function selectRow(label, desc, id, options, value, onchange) {
    var row = U.el('div', { class: 'settings-row' });
    var opts = options.map(function (o) {
      var val = Array.isArray(o) ? o[0] : o;
      var txt = Array.isArray(o) ? o[1] : o;
      return '<option value="' + U.esc(val) + '"' + (val === value ? ' selected' : '') + '>' + U.esc(txt) + '</option>';
    }).join('');
    row.innerHTML = '<div><div class="sr-label">' + label + '</div>' +
      (desc ? '<div class="sr-desc">' + desc + '</div>' : '') + '</div>' +
      '<div class="sr-control"><select class="select" id="' + id + '">' + opts + '</select></div>';
    U.$('#' + id, row).addEventListener('change', onchange);
    return row;
  }

  function block(title, desc) {
    var card = U.el('div', { class: 'card settings-block' });
    card.innerHTML = '<h3>' + U.esc(title) + '</h3>' +
      (desc ? '<div class="sb-desc">' + U.esc(desc) + '</div>' : '');
    return card;
  }

  function toastSaved() {
    MTA.toast('Settings updated', 'success');
  }

  /* ---------- Section: Profile ---------- */
  function renderProfile() {
    var me = MTA.state.currentUser;
    var card = block('Profile', 'Personal details used across the dashboard.');
    card.innerHTML +=
      '<div class="field"><label class="field-label">Display name</label>' +
        '<input class="input" id="st-profi-name" value="' + U.esc(me.displayName || '') + '"></div>' +
      '<div class="field"><label class="field-label">Username</label>' +
        '<input class="input" id="st-profi-user" value="' + U.esc(me.username || '') + '"></div>' +
      '<div class="field"><label class="field-label">Avatar</label>' +
        '<div class="avatar-picker"><span class="avatar-preview" id="st-ava-prev"></span>' +
        '<div class="row wrap" id="st-ava-colors"></div>' +
        '<label class="btn btn-sm" style="cursor:pointer">' + U.icon('ic-upload') +
        '<input type="file" id="st-ava-file" accept="image/*" style="display:none"> Upload</label>' +
        '<button class="btn btn-sm btn-ghost" id="st-ava-clear">Reset</button></div></div>' +
      '<button class="btn btn-primary" id="st-profi-save">' + U.icon('ic-save') + ' Save profile</button>' +
      '<div class="field-hint" id="st-profi-msg" style="margin-top:8px"></div>';

    var colorIdx = me.avatarColor || 0;
    var imgData = me.avatar || null;
    var prev = U.$('#st-ava-prev', card);

    function paint() {
      if (imgData) { prev.innerHTML = '<img src="' + imgData + '" alt="">'; return; }
      var c = U.avatarColor(me.username + '_' + colorIdx);
      prev.style.background = 'linear-gradient(150deg,' + c[0] + ',' + c[1] + ')';
      prev.innerHTML = U.initials(U.$('#st-profi-name', card).value || me.displayName || me.username);
    }
    var colorBox = U.$('#st-ava-colors', card);
    var AVS = ['#55715e', '#5f7c9e', '#a25f55', '#766a9c', '#4d818c', '#b9823f', '#8a6f4a', '#5c5f89'];
    AVS.forEach(function (c, i) {
      var sw = U.el('button', { type: 'button', class: 'avatar-swatch' + (i === colorIdx ? ' on' : ''), style: 'background:' + c });
      sw.addEventListener('click', function () {
        colorIdx = i; imgData = null;
        U.$$('.avatar-swatch', colorBox).forEach(function (x) { x.classList.remove('on'); });
        sw.classList.add('on');
        paint();
      });
      colorBox.appendChild(sw);
    });
    U.$('#st-ava-file', card).addEventListener('change', function () {
      var f = this.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { imgData = rd.result; paint(); };
      rd.readAsDataURL(f);
    });
    U.$('#st-ava-clear', card).addEventListener('click', function () { imgData = null; paint(); });
    U.$('#st-profi-name', card).addEventListener('input', paint);

    U.$('#st-profi-save', card).addEventListener('click', function () {
      var name = U.$('#st-profi-name', card).value.trim();
      var username = U.$('#st-profi-user', card).value.trim();
      if (!name || !username) { MTA.toast('Name and username are required.', 'error'); return; }
      if (MTA.auth.usernameTaken(username, me.id)) { MTA.toast('Username "' + username + '" is already taken.', 'error'); return; }
      MTA.admins.update(me.id, {
        displayName: name, username: username, avatar: imgData, avatarColor: colorIdx
      });
      var st = MTA.state.settings;
      st.profile.displayName = name;
      st.profile.username = username;
      st.profile.avatar = imgData;
      st.profile.avatarColor = colorIdx;
      MTA.state.saveSettings(st);
      if (MTA.app && MTA.app.renderHeader) MTA.app.renderHeader();
      MTA.toast('Profile saved', 'success');
    });
    return card;
  }

  /* ---------- Section: Appearance ---------- */
  function renderAppearance() {
    var a = MTA.state.settings.appearance;
    var card = block('Appearance', 'Theme, sizing and motion preferences.');

    card.innerHTML +=
      '<div class="field"><label class="field-label">Theme</label>' +
        '<label class="theme-option opt-ivory"><input type="radio" name="st-theme" value="ivory"' + (a.theme !== 'charcoal' ? ' checked' : '') + '>' +
        '<span class="theme-preview"><span class="tp-side"><i></i><i></i><i></i></span><span class="tp-main"><i></i><i></i><i></i></span></span>' +
        '<span><b>Ivory Light</b><div class="small muted">Warm creamy white, soft surfaces.</div></span></label>' +
        '<label class="theme-option opt-charcoal"><input type="radio" name="st-theme" value="charcoal"' + (a.theme === 'charcoal' ? ' checked' : '') + '>' +
        '<span class="theme-preview"><span class="tp-side"><i></i><i></i><i></i></span><span class="tp-main"><i></i><i></i><i></i></span></span>' +
        '<span><b>Charcoal Dark</b><div class="small muted">Graphite surfaces, soft white text.</div></span></label></div>';

    card.appendChild(selectRow('Font size', 'Base text scale.', 'st-a-ffsize', [['14', 'Small'], ['16', 'Regular'], ['18', 'Large'], ['20', 'Extra large']], String(a.fontSize), function () {
      a.fontSize = +this.value; MTA.state.saveSettings(MTA.state.settings); MTA.state.applyAppearance(); toastSaved();
    }));
    card.appendChild(selectRow('UI scale', 'Overall interface density.', 'st-a-scale', [['0.9', 'Compact'], ['1', 'Default'], ['1.1', 'Comfortable'], ['1.2', 'Large']], String(a.uiScale), function () {
      a.uiScale = +this.value; MTA.state.saveSettings(MTA.state.settings); MTA.state.applyAppearance();
      S.renderTo(document.getElementById('app-main'), currentSection); toastSaved();
    }));
    card.appendChild(switchRow('Animations', 'Enable UI transitions and effects.', 'st-a-anim', a.animations !== false, function () {
      a.animations = this.checked; MTA.state.saveSettings(MTA.state.settings); MTA.state.applyAppearance(); toastSaved();
    }));
    card.appendChild(switchRow('Reduced motion', 'Minimize all animation and motion.', 'st-a-rm', !!a.reducedMotion, function () {
      a.reducedMotion = this.checked; MTA.state.saveSettings(MTA.state.settings); MTA.state.applyAppearance(); toastSaved();
    }));
    card.appendChild(selectRow('Sidebar', 'Default sidebar behavior on desktop.', 'st-a-sb', [['expanded', 'Expanded'], ['collapsed', 'Collapsed (icons only)']], a.sidebar || 'expanded', function () {
      a.sidebar = this.value;
      document.documentElement.classList.toggle('sb-collapsed', this.value === 'collapsed');
      MTA.state.saveSettings(MTA.state.settings); toastSaved();
    }));

    U.$$('input[name="st-theme"]', card).forEach(function (r) {
      r.addEventListener('change', function () {
        if (r.checked) {
          a.theme = r.value;
          MTA.state.setTheme(r.value, { persist: true });
          MTA.state.applyAppearance();
          toastSaved();
        }
      });
    });
    return card;
  }

  /* ---------- Sections: Dashboard / Projects / Tasks / DevNote / Calendar / Notifications ---------- */
  function renderDashboardSection() {
    var w = MTA.state.settings.dashboard.widgets;
    var card = block('Dashboard', 'Choose which widgets appear on the command center.');
    var defs = [['stats', 'Statistics cards'], ['charts', 'Charts'], ['activity', 'Recent activity'],
      ['projects', 'Recent projects'], ['tasks', 'Upcoming tasks'], ['events', 'Upcoming events'],
      ['active', 'Most active project'], ['quick', 'Quick actions']];
    defs.forEach(function (d) {
      card.appendChild(switchRow(d[1], '', 'st-d-' + d[0], w[d[0]] !== false, function () {
        w[d[0]] = this.checked; MTA.state.saveSettings(MTA.state.settings); toastSaved();
      }));
    });
    return card;
  }

  function renderProjectsSection() {
    var p = MTA.state.settings.projects;
    var card = block('Projects', 'Default project display options.');
    card.appendChild(selectRow('Default view', '', 'st-p-view', [['grid', 'Grid'], ['list', 'List']], p.view, function () { p.view = this.value; MTA.state.saveSettings(MTA.state.settings); toastSaved(); }));
    card.appendChild(selectRow('Default sorting', '', 'st-p-sort', [['updated_desc', 'Recently updated'], ['created_desc', 'Newest first'], ['name_asc', 'Name A-Z'], ['progress_desc', 'Most progress']], p.sort, function () { p.sort = this.value; MTA.state.saveSettings(MTA.state.settings); toastSaved(); }));
    return card;
  }

  function renderTasksSection() {
    var t = MTA.state.settings.tasks;
    var card = block('Tasks', 'Default task display options.');
    card.appendChild(selectRow('Default priority', '', 'st-t-prio', [['Low', 'Low'], ['Medium', 'Medium'], ['High', 'High'], ['Critical', 'Critical']], t.priority, function () { t.priority = this.value; MTA.state.saveSettings(MTA.state.settings); toastSaved(); }));
    card.appendChild(selectRow('Default view', '', 'st-t-view', [['list', 'List'], ['kanban', 'Kanban']], t.view, function () { t.view = this.value; MTA.state.saveSettings(MTA.state.settings); toastSaved(); }));
    return card;
  }

  function renderDevnoteSection() {
    var d = MTA.state.settings.devnote;
    var card = block('DevNote', 'Editor preferences.');
    card.appendChild(selectRow('Auto-save interval', 'How often notes are saved while typing.', 'st-dn-as', [['2', '2 seconds'], ['5', '5 seconds'], ['10', '10 seconds'], ['30', '30 seconds']], String(d.autosave), function () { d.autosave = +this.value; MTA.state.saveSettings(MTA.state.settings); toastSaved(); }));
    card.appendChild(selectRow('Editor font size', '', 'st-dn-fs', [['13', 'Small'], ['14', 'Regular'], ['16', 'Large'], ['18', 'Extra']], String(d.fontSize), function () { d.fontSize = +this.value; MTA.state.saveSettings(MTA.state.settings); toastSaved(); }));
    return card;
  }

  function renderCalendarSection() {
    var c = MTA.state.settings.calendar;
    var card = block('Calendar', 'Calendar display and quick-create options.');
    card.appendChild(selectRow('Week starts on', '', 'st-c-start', [['0', 'Sunday'], ['1', 'Monday']], String(c.startDay), function () { c.startDay = +this.value; MTA.state.saveSettings(MTA.state.settings); toastSaved(); }));
    card.appendChild(selectRow('Date format', '', 'st-c-df', [['YYYY-MM-DD', 'YYYY-MM-DD'], ['MM-DD-YYYY', 'MM-DD-YYYY'], ['DD-MM-YYYY', 'DD-MM-YYYY']], c.dateFormat, function () { c.dateFormat = this.value; MTA.state.saveSettings(MTA.state.settings); toastSaved(); }));
    card.appendChild(selectRow('Time format', '', 'st-c-tf', [['24h', '24-hour'], ['12h', '12-hour']], c.timeFormat, function () { c.timeFormat = this.value; MTA.state.saveSettings(MTA.state.settings); toastSaved(); }));
    card.appendChild(selectRow('Default event duration', '', 'st-c-dur', [['30', '30 min'], ['60', '1 hour'], ['90', '1.5 hours'], ['120', '2 hours']], String(c.defaultDuration), function () { c.defaultDuration = +this.value; MTA.state.saveSettings(MTA.state.settings); toastSaved(); }));
    return card;
  }

  function renderNotifications() {
    var n = MTA.state.settings.notifications;
    var card = block('Notifications', 'How toast notifications behave.');
    card.appendChild(selectRow('Toast duration', '', 'st-n-dur', [['2000', 'Short'], ['3500', 'Normal'], ['5000', 'Long'], ['8000', 'Extra long']], String(n.toastDuration), function () { n.toastDuration = +this.value; MTA.state.saveSettings(MTA.state.settings); toastSaved(); }));
    card.appendChild(switchRow('Show success toasts', 'Confirmations for completed actions.', 'st-n-success', n.showSuccess !== false, function () { n.showSuccess = this.checked; MTA.state.saveSettings(MTA.state.settings); toastSaved(); }));
    return card;
  }

  /* ---------- Section: Keyboard shortcuts ---------- */
  var SHORTCUT_DEFS = [
    ['global-search', 'Global search', 'ctrl+k'],
    ['new-item', 'New item', 'ctrl+n'],
    ['save', 'Save', 'ctrl+s'],
    ['command-palette', 'Command palette', 'ctrl+shift+p'],
    ['dashboard', 'Dashboard', 'ctrl+1'],
    ['projects', 'Projects', 'ctrl+2'],
    ['devnote', 'DevNote', 'ctrl+3'],
    ['tasks', 'Tasks', 'ctrl+4'],
    ['activity', 'Activity', 'ctrl+5'],
    ['calendar', 'Calendar', 'ctrl+6'],
    ['settings', 'Settings', 'ctrl+,']
  ];

  var recorderState = null; /* { id, el } */

  function renderShortcuts() {
    var card = block('Keyboard shortcuts', 'Click a shortcut to record a new combination. Conflicts are detected automatically.');
    var sc = MTA.state.settings.shortcuts;

    function comboLabel(c) { return c.replace('+', ' + ').toUpperCase(); }

    function conflict(id, combo) {
      for (var key in sc) {
        if (sc[key] === combo && key !== id) return true;
      }
      return false;
    }

    SHORTCUT_DEFS.forEach(function (def) {
      var id = def[0], current = sc[id] || def[2];
      var row = U.el('div', { class: 'sc-row' });
      var name = U.el('div', { class: 'sc-name', text: def[1] });
      var info = U.el('div', { class: 'sc-desc' });
      var recorder = U.el('div', { class: 'sc-recorder' });
      var input = U.el('input', { class: 'sc-input', readonly: 'true', value: comboLabel(current), 'aria-label': def[1] + ' shortcut', tabindex: '0' });

      function refresh() {
        var c = sc[id] || def[2];
        input.value = comboLabel(c);
        var clash = conflict(id, c);
        info.innerHTML = clash ? '<span class="sc-conflict">' + U.esc(def[1]) + ' has a conflict</span>' : '';
      }
      info.textContent = current === def[2] ? '' : 'Customized';

      recorder.appendChild(input);
      var resetBtn = U.el('button', { class: 'btn btn-sm btn-ghost', text: 'Reset' });
      resetBtn.addEventListener('click', function () {
        delete sc[id];
        MTA.state.saveSettings(MTA.state.settings);
        if (MTA.app && MTA.app.bindShortcuts) MTA.app.bindShortcuts();
        S.renderTo(document.getElementById('app-main'), currentSection);
        refresh();
        toastSaved();
      });
      recorder.appendChild(resetBtn);

      input.addEventListener('click', function () {
        if (recorderState && recorderState.input !== input) {
          recorderState.input.classList.remove('recording');
          recorderState.input.value = comboLabel(sc[recorderState.id] || def[2]);
        }
        recorderState = { id: id, input: input };
        input.classList.add('recording');
        input.value = 'Press keys...';
      });

      input.addEventListener('keydown', function (e) {
        if (!recorderState || recorderState.input !== input) return;
        e.preventDefault(); e.stopPropagation();
        var parts = [];
        if (e.ctrlKey || e.metaKey) parts.push('ctrl');
        if (e.altKey) parts.push('alt');
        if (e.shiftKey) parts.push('shift');
        var key = e.key.toLowerCase();
        if (['control', 'meta', 'alt', 'shift'].indexOf(key) >= 0) return;
        if (key === 'escape') { input.classList.remove('recording'); input.value = comboLabel(sc[id] || def[2]); recorderState = null; return; }
        if (key.length === 1 && !/^[a-z0-9,]$/.test(key)) return;
        parts.push(key === ' ' ? 'space' : key);
        var combo = parts.join('+');
        if (conflict(id, combo)) {
          MTA.toast('That shortcut is already used by another action.', 'warn');
          return;
        }
        sc[id] = combo;
        MTA.state.saveSettings(MTA.state.settings);
        input.classList.remove('recording');
        input.value = comboLabel(combo);
        toastSaved();
        if (MTA.app && MTA.app.bindShortcuts) MTA.app.bindShortcuts();
        recorderState = null;
        info.textContent = 'Customized';
      });

      row.appendChild(name);
      row.appendChild(info);
      row.appendChild(recorder);
      card.appendChild(row);
    });

    return card;
  }

  /* ---------- Section: Storage ---------- */
  function renderStorage() {
    var card = block('Storage', 'Complete JSON backup, restore and targeted clearing. All data lives in your browser.');
    var usage = MTA.store.usage();
    var items = '';
    Object.keys(usage.items).forEach(function (k) {
      items += '<tr><td class="mono">' + U.esc(k) + '</td><td class="mono">' + U.bytesToStr(usage.items[k]) + '</td></tr>';
    });
    card.innerHTML +=
      '<div class="field"><label class="field-label">Storage used</label>' +
        '<div class="storage-bar"><span style="width:' + Math.min(100, (usage.bytes / usage.estimatedQuota) * 100) + '%"></span></div>' +
        '<div class="field-hint">' + U.bytesToStr(usage.bytes) + ' of ~' + U.bytesToStr(usage.estimatedQuota) + ' used by this app</div></div>' +
      '<div class="field"><div class="row" style="gap:var(--sp-2);flex-wrap:wrap">' +
        '<button class="btn" id="st-exp">' + U.icon('ic-download') + ' Export all data</button>' +
        '<label class="btn" style="cursor:pointer">' + U.icon('ic-upload') +
          '<input type="file" id="st-imp-input" accept="application/json,.json" style="display:none"> Import data</label>' +
        '<button class="btn btn-danger" id="st-clear-selected">' + U.icon('ic-trash') + ' Clear selected...</button>' +
      '</div></div>' +
      '<div class="field"><label class="field-label">Current keys</label>' +
        '<div class="table-wrap"><table class="tbl"><thead><tr><th>Key</th><th>Size</th></tr></thead><tbody>' +
        (items || '<tr><td colspan="2"><span class="small muted">No mta_* keys found.</span></td></tr>') +
        '</tbody></table></div></div>';

    U.$('#st-exp', card).addEventListener('click', function () {
      var data = MTA.store.exportAll();
      U.download('mta-devdashboard-backup-' + U.todayStr() + '.json', JSON.stringify(data, null, 2), 'application/json');
      MTA.toast('Backup exported', 'success');
    });

    var fileInput = U.$('#st-imp-input', card);
    fileInput.addEventListener('change', function () {
      var f = fileInput.files[0];
      if (!f) return;
      U.readFile(f).then(function (text) {
        var obj;
        try { obj = JSON.parse(text); } catch (err) { MTA.toast('That file is not valid JSON.', 'error'); return; }
        var v = MTA.store.validateImport(obj);
        if (!v.ok) {
          MTA.toast('Invalid backup: ' + v.errors.join(' '), 'error');
          return;
        }
        var counts = 'This will replace current data with: ' + obj.users.length + ' admins, ' +
          obj.projects.length + ' projects, ' + obj.notes.length + ' notes, ' +
          obj.tasks.length + ' tasks, ' + obj.events.length + ' events.';
        MTA.modal.confirm({
          title: 'Import backup',
          message: counts + ' Continue?',
          confirmLabel: 'Import',
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          var r = MTA.store.importAll(obj);
          if (r.ok) {
            MTA.state.loadSettings();
            MTA.auth.destroySession();
            if (MTA.app && MTA.app.showAuth) MTA.app.showAuth(null);
            MTA.toast('Backup imported. Please sign in again.', 'success');
          } else {
            MTA.toast(r.errors.join(' '), 'error');
          }
        });
      }).catch(function () { MTA.toast('Could not read that file.', 'error'); });
      fileInput.value = '';
    });

    U.$('#st-clear-selected', card).addEventListener('click', function () {
      var body = U.el('div', {});
      var targets = ['projects', 'notes', 'tasks', 'events', 'activity', 'settings', 'admins'];
      targets.forEach(function (t) {
        var cb = U.el('label', { class: 'ck' });
        var inp = U.el('input', { type: 'checkbox', value: t });
        cb.appendChild(inp);
        cb.appendChild(U.el('span', { text: t.charAt(0).toUpperCase() + t.slice(1) }));
        body.appendChild(cb);
        body.appendChild(U.el('br', {}));
      });
      MTA.modal.open({
        title: 'Clear selected data',
        body: body,
        actions: [
          { label: 'Cancel', cls: 'btn-ghost' },
          {
            label: 'Clear', cls: 'btn-danger',
            click: function () {
              var chosen = [];
              U.$$('input:checked', body).forEach(function (cb) { chosen.push(cb.value); });
              if (!chosen.length) { MTA.toast('Select at least one dataset.', 'error'); return false; }
              MTA.store.clearSelected(chosen);
              MTA.toast('Cleared: ' + chosen.join(', '), 'success');
              S.renderTo(document.getElementById('app-main'), currentSection);
              return true;
            }
          }
        ]
      });
    });
    return card;
  }

  /* ---------- Section: Security ---------- */
  function renderSecurity() {
    var card = block('Security', 'Password, session and sign-in preferences.');
    card.innerHTML += '<div class="field"><label class="field-label">Change password</label>' +
      '<div class="form-grid">' +
        '<div class="field"><input class="input" type="password" id="st-s-curr" placeholder="Current password" autocomplete="current-password"></div>' +
        '<div class="field"><input class="input" type="password" id="st-s-next" placeholder="New password (min 6)" autocomplete="new-password"></div>' +
        '<div class="field span2"><input class="input" type="password" id="st-s-next2" placeholder="Repeat new password" autocomplete="new-password">' +
        '<div class="field-hint" id="st-s-msg"></div></div>' +
      '</div>' +
      '<button class="btn btn-primary" id="st-s-change">' + U.icon('ic-lock') + ' Update password</button></div>';

    var sec = MTA.state.settings.security || { idleTimeout: 30 };
    card.appendChild(selectRow('Auto-lock', 'Lock the dashboard after inactivity (minutes). 0 disables.', 'st-s-idle', [['0', 'Never'], ['5', '5 minutes'], ['15', '15 minutes'], ['30', '30 minutes'], ['60', '60 minutes']], String(sec.idleTimeout), function () {
      MTA.state.settings.security = MTA.state.settings.security || {};
      MTA.state.settings.security.idleTimeout = +this.value;
      MTA.state.saveSettings(MTA.state.settings);
      toastSaved();
    }));
    card.appendChild(switchRow('Remember me by default', 'Keep the session after closing the browser.', 'st-s-remember', MTA.state.settings.security.remember !== false, function () {
      MTA.state.settings.security = MTA.state.settings.security || {};
      MTA.state.settings.security.remember = this.checked;
      MTA.state.saveSettings(MTA.state.settings);
      toastSaved();
    }));

    U.$('#st-s-change', card).addEventListener('click', function () {
      var cur = U.$('#st-s-curr', card).value;
      var n1 = U.$('#st-s-next', card).value;
      var n2 = U.$('#st-s-next2', card).value;
      var msg = U.$('#st-s-msg', card);
      if (n1 !== n2) { msg.innerHTML = '<span class="sc-conflict">Passwords do not match.</span>'; return; }
      var r = MTA.auth.changePassword(MTA.state.currentUser, cur, n1);
      if (!r.ok) { msg.innerHTML = '<span class="sc-conflict">' + U.esc(r.error) + '</span>'; return; }
      msg.innerHTML = '';
      U.$('#st-s-curr', card).value = '';
      U.$('#st-s-next', card).value = '';
      U.$('#st-s-next2', card).value = '';
      MTA.activity.track('password', 'Changed account password', {});
      MTA.toast('Password updated', 'success');
    });

    var logOutBtn = U.el('button', { class: 'btn btn-danger', html: U.icon('ic-logout') + ' Sign out' });
    logOutBtn.addEventListener('click', function () {
      MTA.modal.confirm({ title: 'Sign out', message: 'Sign out of the dashboard?' }).then(function (ok) {
        if (!ok) return;
        MTA.auth.logout();
        if (MTA.app && MTA.app.showAuth) MTA.app.showAuth(null);
      });
    });
    card.appendChild(U.el('div', { class: 'field', style: 'margin-top:8px' }));
    card.appendChild(logOutBtn);
    return card;
  }

  /* ---------- Section: Advanced ---------- */
  function renderAdvanced() {
    var card = block('Advanced', 'Reset and diagnostic tools.');
    card.innerHTML +=
      '<div class="field"><label class="field-label">Debug information</label>' +
        '<pre class="debug-pre" id="st-debug"></pre></div>' +
      '<div class="row" style="gap:var(--sp-2);flex-wrap:wrap">' +
        '<button class="btn" id="st-reset-settings">' + U.icon('ic-refresh') + ' Reset settings</button>' +
        '<button class="btn btn-danger" id="st-reset-app">' + U.icon('ic-alert') + ' Reset application</button>' +
      '</div>' +
      '<div class="field-hint" style="margin-top:8px">Reset application deletes everything (admins, projects, notes, tasks, events, activity) and restores the sample workspace.</div>';

    var debug = {
      version: '1.0.0',
      app: 'mta-devdashboard',
      userAgent: navigator.userAgent,
      theme: MTA.state.theme,
      usesLightMode: MTA.state.theme === 'ivory',
      storageBytes: MTA.store.usage().bytes,
      counts: {
        users: MTA.store.users().length,
        projects: MTA.store.projects().length,
        notes: MTA.store.notes().length,
        tasks: MTA.store.tasks().length,
        events: MTA.store.events().length,
        activity: MTA.store.activity().length
      }
    };
    var pre = U.$('#st-debug', card);
    pre.textContent = JSON.stringify(debug, null, 2);

    U.$('#st-reset-settings', card).addEventListener('click', function () {
      MTA.modal.confirm({ title: 'Reset settings', message: 'Restore all settings and shortcuts to defaults?' }).then(function (ok) {
        if (!ok) return;
        var s = MTA.store.defaultSettings();
        var preset = MTA.state.settings || {};
        if (preset.profile) s.profile = preset.profile;
        MTA.state.saveSettings(s);
        MTA.state.applyAppearance();
        if (MTA.app && MTA.app.bindShortcuts) MTA.app.bindShortcuts();
        MTA.state.setTheme(s.appearance.theme || 'ivory', { persist: true });
        S.renderTo(document.getElementById('app-main'), currentSection);
        MTA.toast('Settings reset', 'success');
      });
    });

    U.$('#st-reset-app', card).addEventListener('click', function () {
      MTA.modal.confirm({ title: 'Reset application', message: 'Delete ALL local data and restore the sample workspace? This cannot be undone.', danger: true, confirmLabel: 'Reset' })
        .then(function (ok) {
          if (!ok) return;
          MTA.store.resetApplication();
          MTA.state.setUser(null);
          if (MTA.app && MTA.app.showAuth) MTA.app.showAuth(null);
          MTA.toast('Application reset', 'warning', 'Reset');
        });
    });
    return card;
  }

  /* ---------- Main render ---------- */
  var RENDERERS = {
    profile: renderProfile,
    appearance: renderAppearance,
    dashboard: renderDashboardSection,
    projects: renderProjectsSection,
    tasks: renderTasksSection,
    devnote: renderDevnoteSection,
    calendar: renderCalendarSection,
    notifications: renderNotifications,
    shortcuts: renderShortcuts,
    storage: renderStorage,
    security: renderSecurity,
    advanced: renderAdvanced
  };

  function navHtml() {
    var html = '';
    var lastGroup = null;
    SECTIONS.forEach(function (sec) {
      if (sec.group !== lastGroup) {
        html += '<div class="sn-group">' + sec.group + '</div>';
        lastGroup = sec.group;
      }
      html += '<button data-sec="' + sec.id + '" class="' + (sec.id === currentSection ? 'active' : '') + '">' +
        U.icon(sec.icon) + '<span>' + sec.label + '</span></button>';
    });
    return html;
  }

  S.renderTo = function (main, section) {
    currentSection = section || currentSection;
    var renderer = RENDERERS[currentSection];
    if (!renderer) renderer = renderProfile;

    var html =
      '<div class="page" data-page="settings">' +
      '<div class="page-head"><div><h2>Settings</h2><div class="sub">Tune every corner of your workspace</div></div></div>' +
      '<div class="settings-wrap">' +
        '<nav class="settings-nav" aria-label="Settings sections">' + navHtml() + '</nav>' +
        '<div class="settings-section" id="st-section"></div>' +
      '</div></div>';
    main.innerHTML = html;
    var box = U.$('#st-section', main);
    box.appendChild(renderer());

    if (!S._navBound) {
      S._navBound = true;
      main.addEventListener('click', function (e) {
        var b = e.target.closest('[data-sec]');
        if (b) {
          currentSection = b.dataset.sec;
          S.renderTo(main, currentSection);
          MTA.app && MTA.app.scrollMainTop && MTA.app.scrollMainTop();
        }
      });
    }
  };

  S.render = function (main) {
    S.renderTo(main, currentSection);
  };

  MTA.settings = S;
})(typeof window !== 'undefined' ? window : this);