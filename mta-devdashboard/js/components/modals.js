/* ============================================================
   MTA DevDashboard - components/modals.js
   Modals, drawers, confirm and prompt dialogs.
   ============================================================ */
(function (global) {
  'use strict';
  var MTA = (global.MTA = global.MTA || {});
  var U = MTA.utils;
  var MO = {};

  var stack = [];
  var root = document.getElementById('modal-root');

  function onKey(e) {
    if (stack.length === 0) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeTop();
    }
  }
  document.addEventListener('keydown', onKey);

  function closeTop() {
    var top = stack[stack.length - 1];
    if (top) top.close();
  }

  function apiFor(entry) {
    return {
      element: entry.modal,
      body: entry.body,
      close: entry.close
    };
  }

  /* ---------- Open ---------- */
  MO.open = function (opts) {
    if (!opts || (!opts.title && !opts.body)) return null;

    var dim = U.el('div', { class: 'modal-overlay' });
    var modal = U.el('div', {
      class: 'modal ' + (opts.size === 'xl' ? 'modal-xl' : opts.size === 'lg' ? 'modal-lg' : opts.size === 'sm' ? 'modal-sm' : ''),
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': opts.title || 'Dialog'
    });

    var inner = '<div class="modal-head"><h3>' + U.esc(opts.title || '') + '</h3>' +
      '<button class="icon-btn js-close" aria-label="Close">' + U.icon('ic-close') + '</button></div>';
    inner += '<div class="modal-body js-body"></div>';
    if (opts.footer || opts.actions) inner += '<div class="modal-foot js-foot"></div>';
    modal.innerHTML = inner;

    var bodyEl = U.$('.js-body', modal);
    if (typeof opts.body === 'string') bodyEl.innerHTML = opts.body;
    else if (opts.body) bodyEl.appendChild(opts.body);

    var footEl = U.$('.js-foot', modal);

    var entry = null;

    if (opts.actions) {
      if (!footEl) {
        footEl = document.createElement('div');
        footEl.className = 'modal-foot';
        modal.appendChild(footEl);
      }
      opts.actions.forEach(function (ac) {
        var b = U.el('button', { class: 'btn ' + (ac.cls || ''), text: ac.label });
        b.addEventListener('click', function () {
          var r = ac.click ? ac.click(apiFor(entry)) : true;
          if (r !== false) entry.close();
        });
        footEl.appendChild(b);
      });
    } else if (opts.footer && footEl) {
      footEl.innerHTML = opts.footer;
    }

    function close() {
      if (dim.parentNode) dim.parentNode.removeChild(dim);
      var idx = stack.indexOf(entry);
      if (idx >= 0) stack.splice(idx, 1);
      document.body.style.overflow = stack.length ? 'hidden' : '';
      if (opts.onClose) opts.onClose();
    }

    entry = {
      dim: dim, modal: modal, body: bodyEl, close: close
    };
    stack.push(entry);

    dim.appendChild(modal);
    root.appendChild(dim);
    document.body.style.overflow = 'hidden';

    U.$('.js-close', modal).addEventListener('click', close);
    dim.addEventListener('mousedown', function (e) {
      if (e.target === dim && opts.closable !== false) close();
    });

    var firstInput = modal.querySelector('input, textarea, select');
    if (firstInput) setTimeout(function () { firstInput.focus(); }, 30);

    if (opts.onMount) opts.onMount(apiFor(entry));
    return apiFor(entry);
  };

  MO.close = function () { closeTop(); };

  MO.closeAll = function () {
    while (stack.length) closeTop();
  };

  /* ---------- Confirm ---------- */
  MO.confirm = function (opts) {
    return new Promise(function (resolve) {
      var body = U.el('div', {});
      body.innerHTML =
        '<p class="small muted">' + U.esc(opts.message || 'Are you sure?') + '</p>';
      MO.open({
        title: opts.title || 'Please confirm',
        size: 'sm',
        body: body,
        actions: [
          { label: opts.cancelLabel || 'Cancel', cls: 'btn-ghost', click: function () { return true; } },
          { label: opts.confirmLabel || 'Confirm', cls: opts.danger ? 'btn-danger' : 'btn-primary', click: function () { resolve(true); return true; } }
        ],
        onClose: function () { resolve(false); }
      });
    });
  };

  /* ---------- Prompt ---------- */
  MO.prompt = function (opts) {
    return new Promise(function (resolve) {
      var body = U.el('div', {});
      var label = U.el('label', { class: 'field-label', text: opts.label || opts.title || 'Value' });
      var input = U.el('input', {
        class: 'input', type: opts.type || 'text',
        placeholder: opts.placeholder || '',
        value: opts.value || ''
      });
      if (opts.required) input.required = true;
      body.appendChild(label);
      body.appendChild(U.el('div', { style: 'margin-bottom:8px' }));
      body.appendChild(input);

      MO.open({
        title: opts.title || 'Enter a value',
        size: 'sm',
        body: body,
        actions: [
          { label: 'Cancel', cls: 'btn-ghost', click: function () { return true; } },
          {
            label: 'OK', cls: 'btn-primary',
            click: function (api) {
              var v = input.value.trim();
              if (opts.required && !v) {
                input.focus();
                return false;
              }
              resolve(v);
              return true;
            }
          }
        ],
        onClose: function () { resolve(null); },
        onMount: function () { setTimeout(function () { input.focus(); input.select(); }, 40); }
      });
    });
  };

  /* ---------- Drawer ---------- */
  MO.drawer = function (opts) {
    var dim = U.el('div', { class: 'drawer-overlay' });
    var drawer = U.el('div', {
      class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || 'Details'
    });
    drawer.innerHTML =
      '<div class="drawer-head">' +
        '<h3>' + U.esc(opts.title || '') + '</h3>' +
        '<button class="icon-btn js-close" aria-label="Close">' + U.icon('ic-close') + '</button>' +
      '</div>' +
      '<div class="drawer-body js-body"></div>';
    if (opts.footer) drawer.innerHTML += '<div class="drawer-foot js-foot"></div>';

    var bodyEl = U.$('.js-body', drawer);
    if (typeof opts.body === 'string') bodyEl.innerHTML = opts.body;
    else if (opts.body) bodyEl.appendChild(opts.body);

    var footEl = U.$('.js-foot', drawer);
    if (footEl) footEl.innerHTML = opts.footer;

    function close() {
      if (dim.parentNode) dim.parentNode.removeChild(dim);
      drawer.parentNode && drawer.parentNode.removeChild(drawer);
      document.body.style.overflow = stack.length ? 'hidden' : '';
      if (opts.onClose) opts.onClose();
    }

    document.body.appendChild(dim);
    document.body.appendChild(drawer);
    document.body.style.overflow = 'hidden';

    U.$('.js-close', drawer).addEventListener('click', close);
    dim.addEventListener('mousedown', function (e) {
      if (e.target === dim) close();
    });

    var api = { element: drawer, close: close, body: bodyEl };
    if (opts.onMount) opts.onMount(api);
    return api;
  };

  MTA.modal = MO;
})(typeof window !== 'undefined' ? window : this);