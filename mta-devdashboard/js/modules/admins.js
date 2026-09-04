/* ============================================================
   MTA DevDashboard - modules/admins.js
   Admin management. Only Super Admin can access this page.
   ============================================================ */
(function (global) {
  'use strict';
  var MTA = (global.MTA = global.MTA || {});
  var U = MTA.utils;
  var AD = {};

  var PERM_LABELS = [
    ['dashboard', 'Dashboard'], ['projects', 'Projects'], ['devnote', 'DevNote'],
    ['tasks', 'Tasks'], ['activity', 'Activity'], ['calendar', 'Calendar'],
    ['admins', 'Admins'], ['settings', 'Settings']
  ];

  AD.list = function () { return MTA.store.users(); };
  AD.get = function (id) { return MTA.auth.getUserById(id); };

  AD.create = function (data) {
    var users = AD.list();
    var now = new Date().toISOString();
    var u = {
      id: U.uid('usr'), username: data.username, displayName: data.displayName,
      password: U.hashPassword(data.password), role: data.role || 'admin',
      status: data.status || 'active', permissions: data.permissions || [],
      avatar: data.avatar || null, avatarColor: data.avatarColor != null ? data.avatarColor : 0,
      createdAt: now, lastLogin: null
    };
    users.push(u);
    MTA.store.saveUsers(users);
    MTA.activity.track('admins', 'Created admin ' + u.displayName, { entityType: 'admin', entityId: u.id });
    MTA.state.bump('admins');
    return u;
  };

  AD.update = function (id, patch) {
    var users = AD.list();
    var idx = users.findIndex(function (u) { return u.id === id; });
    if (idx < 0) return null;
    users[idx] = Object.assign({}, users[idx], patch);
    /* never allow removing the last active super admin */
    var sad = users.filter(function (u) {
      return u.role === 'super_admin' && u.status === 'active';
    });
    if (!sad.length) {
      users[idx] = Object.assign({}, users[idx], { role: 'super_admin', status: 'active' });
    }
    MTA.store.saveUsers(users);
    if (MTA.state.currentUser && MTA.state.currentUser.id === id) {
      MTA.state.setUser(users[idx]);
    }
    MTA.activity.track('admins', 'Updated admin ' + users[idx].displayName, { entityType: 'admin', entityId: id });
    MTA.state.bump('admins');
    return users[idx];
  };

  AD.remove = function (id) {
    var me = MTA.state.currentUser;
    if (me && me.id === id) return { ok: false, error: 'You cannot delete your own account.' };
    var u = AD.get(id);
    if (!u) return { ok: false, error: 'Not found.' };
    if (u.role === 'super_admin') {
      var sad = AD.list().filter(function (x) {
        return x.role === 'super_admin' && x.status === 'active' && x.id !== id;
      });
      if (!sad.length) return { ok: false, error: 'At least one active Super Admin is required.' };
    }
    var users = AD.list().filter(function (x) { return x.id !== id; });
    MTA.store.saveUsers(users);
    MTA.activity.track('admins', 'Deleted admin ' + u.displayName, { entityType: 'admin', entityId: id });
    MTA.state.bump('admins');
    return { ok: true };
  };

  /* ---------- Avatar ---------- */
  function avatarHtml(u, size) {
    var s = size || 36;
    if (u.avatar && u.avatar.indexOf('data:') === 0) {
      return '<img src="' + u.avatar + '" style="width:' + s + 'px;height:' + s +
        'px;border-radius:50%;object-fit:cover" alt="">';
    }
    var c = U.avatarColor(u.username + '_' + (u.avatarColor || 0));
    return '<span style="display:inline-grid;place-items:center;width:' + s + 'px;height:' + s +
      'px;border-radius:50%;background:linear-gradient(150deg,' + c[0] + ',' + c[1] + ');color:#fff;' +
      'font-weight:700;font-size:' + Math.round(s * 0.4) + 'px">' +
      U.initials(u.displayName || u.username) + '</span>';
  }

  /* ---------- Render ---------- */
  AD.render = function (main) {
    var me = MTA.state.currentUser;
    var users = AD.list();
    var active = users.filter(function (u) { return u.status === 'active'; }).length;

    var rows = users.map(function (u) {
      var isSelf = me && me.id === u.id;
      var permsChip;
      if (u.role === 'super_admin') {
        permsChip = '<span class="chip">All sections</span>';
      } else {
        var shown = (u.permissions || []).slice(0, 3).map(function (p) {
          var lb = p;
          PERM_LABELS.forEach(function (pl) { if (pl[0] === p) lb = pl[1]; });
          return '<span class="chip tag">' + U.esc(lb) + '</span>';
        }).join('');
        var extra = (u.permissions || []).length > 3 ? '<span class="chip">+' + ((u.permissions || []).length - 3) + '</span>' : '';
        permsChip = shown + extra;
      }
      var statusChip = u.status === 'active'
        ? '<span class="badge b-deployed"><span class="b-dot"></span>Active</span>'
        : '<span class="badge b-todo"><span class="b-dot"></span>Deactivated</span>';
      return '<tr data-id="' + u.id + '">' +
        '<td><div class="row">' + avatarHtml(u, 34) + '<div><div>' + U.esc(u.displayName || u.username) +
          (isSelf ? ' <span class="chip tag">you</span>' : '') + '</div>' +
          '<div class="tiny muted mono">' + U.esc(u.username) + '</div></div></div></td>' +
        '<td>' + (u.role === 'super_admin'
          ? '<span class="badge b-development"><span class="b-dot"></span>Super Admin</span>'
          : '<span class="badge b-in-progress"><span class="b-dot"></span>Admin</span>') + '</td>' +
        '<td>' + statusChip + '</td>' +
        '<td class="small">' + U.fmtDate(u.createdAt) + '</td>' +
        '<td class="small">' + (u.lastLogin ? U.timeAgo(u.lastLogin) : '<span class="muted">Never</span>') + '</td>' +
        '<td><div class="row wrap" style="max-width:200px">' + permsChip + '</div></td>' +
        '<td><div class="row-actions">' +
          '<button class="icon-btn btn-sm js-ad-edit" data-id="' + u.id + '" title="Edit">' + U.icon('ic-edit') + '</button>' +
          (isSelf ? '' : '<button class="icon-btn btn-sm js-ad-del" data-id="' + u.id + '" title="Delete">' + U.icon('ic-trash') + '</button>') +
        '</div></td>' +
      '</tr>';
    }).join('');

    var html =
      '<div class="page" data-page="admins">' +
      '<div class="page-head"><div><h2>Admins</h2>' +
      '<div class="sub">' + active + ' active &middot; ' + users.length + ' total</div></div>' +
      '<div class="page-head-actions"><button class="btn btn-primary" id="ad-new">' + U.icon('ic-plus') + ' New admin</button></div></div>' +
      '<div class="card table-wrap"><table class="tbl">' +
        '<thead><tr><th>Admin</th><th>Role</th><th>Status</th><th>Created</th><th>Last login</th><th>Permissions</th><th style="width:80px"></th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="7"><div class="empty">no admins</div></td></tr>') + '</tbody>' +
      '</table></div>' +
      '<div class="card" style="margin-top:var(--sp-4)"><div class="card-body">' +
        '<div class="row" style="gap:var(--sp-3);align-items:flex-start">' + U.icon('ic-info') +
        '<p class="small muted" style="margin:0">Passwords are stored as obfuscated hashes in your browser only. ' +
        'Super Admin accounts control everything; regular admins only get the sections you grant them.</p></div>' +
      '</div></div></div>';

    main.innerHTML = html;

    U.$('#ad-new', main).addEventListener('click', function () { openForm(null); });

    if (!AD._clickBound) {
      AD._clickBound = true;
      main.addEventListener('click', function (e) {
        var edit = e.target.closest('.js-ad-edit');
        if (edit) { openForm(AD.get(edit.dataset.id)); return; }
        var del = e.target.closest('.js-ad-del');
        if (del) {
          var u = AD.get(del.dataset.id);
          MTA.modal.confirm({
            title: 'Delete admin',
            message: 'Delete "' + (u ? u.displayName : '') + '"? They will lose access immediately.',
            danger: true, confirmLabel: 'Delete'
          }).then(function (ok) {
            if (!ok) return;
            var r = AD.remove(del.dataset.id);
            if (r.ok) { MTA.toast('Admin deleted', 'warning', 'Deleted'); AD.render(main); }
            else MTA.toast(r.error, 'error');
          });
          return;
        }
      });
    }
  };

  /* ---------- Form ---------- */
  function openForm(user) {
    var editing = !!user;
    var isSuperTarget = editing && user.role === 'super_admin';
    var myself = MTA.state.currentUser;
    var isSelf = editing && myself && myself.id === user.id;

    var perms = user && user.permissions ? user.permissions : ['dashboard', 'projects', 'devnote', 'tasks'];
    var permissionsHtml = PERM_LABELS.map(function (pl) {
      var checked = perms.indexOf(pl[0]) >= 0;
      return '<label class="ck"><input type="checkbox" value="' + pl[0] + '"' + (checked ? ' checked' : '') + '>' +
        '<span>' + pl[1] + '</span></label>';
    }).join('');

    var body = U.el('div', {});
    body.innerHTML =
      '<form class="form-grid" id="ad-form">' +
        '<div class="field"><label class="field-label">Display name <span class="req">*</span></label>' +
          '<input class="input" id="ad-name" required value="' + U.esc(user ? user.displayName : '') + '"></div>' +
        '<div class="field"><label class="field-label">Username <span class="req">*</span></label>' +
          '<input class="input" id="ad-user" required value="' + U.esc(user ? user.username : '') + '"></div>' +
        (!editing
          ? '<div class="field"><label class="field-label">Password <span class="req">*</span></label>' +
            '<input class="input" id="ad-pass" type="password" required minlength="6" placeholder="Min 6 characters"></div>'
          : '<div class="field"><label class="field-label">Password</label>' +
            '<input class="input" id="ad-pass" type="password" placeholder="Leave blank to keep current"></div>') +
        '<div class="field"><label class="field-label">Role</label>' +
          '<select class="select" id="ad-role"' + (isSelf ? ' disabled' : '') + '>' +
            '<option value="admin"' + (user && user.role === 'admin' ? ' selected' : '') + '>Admin</option>' +
            '<option value="super_admin"' + (user && user.role === 'super_admin' ? ' selected' : '') + '>Super Admin</option>' +
          '</select></div>' +
        '<div class="field"><label class="field-label">Status</label>' +
          '<select class="select" id="ad-status"' + (isSelf ? ' disabled' : '') + '>' +
            '<option value="active"' + (!user || user.status === 'active' ? ' selected' : '') + '>Active</option>' +
            '<option value="deactivated"' + (user && user.status === 'deactivated' ? ' selected' : '') + '>Deactivated</option>' +
          '</select></div>' +
        '<div class="field span2"><label class="field-label">Avatar</label>' +
          '<div class="avatar-picker">' +
            '<span class="avatar-preview" id="ad-avatar-preview"></span>' +
            '<div class="row wrap" id="ad-avatar-colors"></div>' +
            '<label class="btn btn-sm" style="cursor:pointer">' + U.icon('ic-upload') +
              '<input type="file" id="ad-avatar-file" accept="image/*" style="display:none"> Upload</label>' +
            '<button type="button" class="btn btn-sm btn-ghost" id="ad-avatar-clear">Reset</button>' +
          '</div></div>' +
        '<div class="field span2"' + (isSuperTarget && !isSelf ? '' : '') + '><label class="field-label">Access to sections</label>' +
          '<div class="row wrap" id="ad-perms" style="gap:var(--sp-2)">' + permissionsHtml + '</div>' +
          '<div class="field-hint" id="ad-perms-hint">Super Admins get everything automatically.</div></div>' +
      '</form>';

    /* avatar preview state */
    var preview = U.$('#ad-avatar-preview', body);
    var colorIdx = user ? (user.avatarColor || 0) : 0;
    var imgData = user ? (user.avatar || null) : null;

    function paintPreview() {
      if (imgData) {
        preview.innerHTML = '<img src="' + imgData + '" alt="">';
        return;
      }
      var c = U.avatarColor((user ? user.username : '') + '_' + colorIdx);
      preview.style.background = 'linear-gradient(150deg,' + c[0] + ',' + c[1] + ')';
      preview.innerHTML = U.initials((user ? user.displayName : '') || 'New');
    }
    var colorBox = U.$('#ad-avatar-colors', body);
    var AV_COLORS = ['#55715e', '#5f7c9e', '#a25f55', '#766a9c', '#4d818c', '#b9823f', '#8a6f4a', '#5c5f89'];
    AV_COLORS.forEach(function (c, i) {
      var sw = U.el('button', { type: 'button', class: 'avatar-swatch' + (i === colorIdx ? ' on' : ''), style: 'background:' + c });
      sw.addEventListener('click', function () {
        colorIdx = i; imgData = null;
        U.$$('.avatar-swatch', colorBox).forEach(function (s) { s.classList.remove('on'); });
        sw.classList.add('on');
        paintPreview();
      });
      colorBox.appendChild(sw);
    });
    paintPreview();
    var fileInput = U.$('#ad-avatar-file', body);
    fileInput.addEventListener('change', function () {
      var f = fileInput.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        imgData = rd.result;
        paintPreview();
      };
      rd.readAsDataURL(f);
    });
    U.$('#ad-avatar-clear', body).addEventListener('click', function () {
      imgData = null;
      fileInput.value = '';
      paintPreview();
    });
    U.$('#ad-name', body).addEventListener('input', paintPreview);
    U.$('#ad-role', body).addEventListener('change', function () {
      var superSel = this.value === 'super_admin';
      U.$$('#ad-perms .ck input', body).forEach(function (cb) {
        if (superSel) { cb.checked = true; cb.disabled = true; }
        else cb.disabled = false;
      });
    });
    if (user && user.role === 'super_admin') {
      U.$$('#ad-perms .ck input', body).forEach(function (cb) { cb.checked = true; cb.disabled = true; });
    }

    MTA.modal.open({
      title: editing ? 'Edit admin' : 'New admin',
      size: 'lg',
      body: body,
      actions: [
        { label: 'Cancel', cls: 'btn-ghost' },
        {
          label: editing ? 'Save changes' : 'Create admin', cls: 'btn-primary',
          click: function () {
            var form = U.$('#ad-form', body);
            if (!form.reportValidity()) return false;
            var name = U.$('#ad-name', body).value.trim();
            var username = U.$('#ad-user', body).value.trim();
            var password = U.$('#ad-pass', body).value;
            if (!name || !username) return false;
            if (MTA.auth.usernameTaken(username, editing ? user.id : null)) {
              MTA.toast('Username "' + username + '" is already taken.', 'error');
              return false;
            }
            var roleSel = U.$('#ad-role', body).value;
            var statusVal = U.$('#ad-status', body).value;
            var permsList = [];
            if (roleSel === 'super_admin') {
              PERM_LABELS.forEach(function (pl) { permsList.push(pl[0]); });
            } else {
              U.$$('#ad-perms .ck input', body).forEach(function (cb) {
                if (cb.checked) permsList.push(cb.value);
              });
              if (!permsList.length) {
                MTA.toast('Select at least one section for this admin.', 'error');
                return false;
              }
            }
            var patch = {
              displayName: name,
              username: username,
              role: roleSel,
              status: statusVal,
              permissions: permsList,
              avatar: imgData,
              avatarColor: colorIdx
            };
            if (editing) {
              if (password) AD.update(user.id, Object.assign(patch, { password: U.hashPassword(password) }));
              else AD.update(user.id, patch);
              MTA.toast('Admin updated', 'success');
            } else {
              AD.create(Object.assign(patch, { password: password }));
              MTA.toast('Admin created', 'success');
            }
            AD.render(document.getElementById('app-main'));
            return true;
          }
        }
      ],
      onMount: function () {
        U.$('#ad-name', body).focus();
        if (!editing) U.$('#ad-pass', body).focus();
      }
    });
  }

  AD.avatarHtml = avatarHtml;
  AD.PERM_LABELS = PERM_LABELS;
  MTA.admins = AD;
})(typeof window !== 'undefined' ? window : this);