/* ============================================================
   MTA DevDashboard — utils.js
   Core helpers: DOM, strings, dates, hashing.
   ============================================================ */
(function (global) {
  'use strict';
  var MTA = (global.MTA = global.MTA || {});
  var U = {};

  /* ---------- DOM ---------- */
  U.$ = function (sel, root) { return (root || document).querySelector(sel); };
  U.$$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  U.el = function (tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null) return;
        if (k === 'class') n.className = v;
        else if (k === 'html') n.innerHTML = v;
        else if (k === 'text') n.textContent = v;
        else if (k === 'dataset') {
          var ds = n.dataset || (n.dataset = {});
          Object.keys(v).forEach(function (dk) { ds[dk] = v[dk]; });
        } else if (k.indexOf('on') === 0 && typeof v === 'function') {
          n.addEventListener(k.slice(2), v);
        } else if (v === true) n.setAttribute(k, '');
        else n.setAttribute(k, v);
      });
    }
    if (children != null) {
      var kids = Array.isArray(children) ? children : [children];
      kids.forEach(function (c) {
        if (c == null || c === false) return;
        n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return n;
  };

  U.icon = function (id, cls) {
    return '<svg class="ic ' + (cls || '') + '" aria-hidden="true"><use href="#' +
      id + '"></use></svg>';
  };

  /* ---------- Strings ---------- */
  U.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  U.stripHtml = function (html) {
    var d = document.createElement('div');
    d.innerHTML = html || '';
    return d.textContent || d.innerText || '';
  };

  U.truncate = function (s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, Math.max(0, n - 1)) + '\u2026' : s;
  };

  U.uid = function (prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) +
      '_' + Math.random().toString(36).slice(2, 8);
  };

  U.randToken = function () {
    var c = 'abcdef0123456789';
    var s = '';
    for (var i = 0; i < 32; i++) {
      s += c.charAt(Math.floor(Math.random() * c.length));
    }
    return s;
  };

  /* Deterministic hash — obfuscation only, never real security. */
  U.hash = function (str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57, ch, i;
    for (i = 0; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') +
      (h1 >>> 0).toString(16).padStart(8, '0');
  };

  U.hashPassword = function (pw) {
    return U.hash('mta::devdash::' + pw + '::salt1');
  };

  /* ---------- Numbers ---------- */
  U.clamp = function (v, min, max) { return Math.max(min, Math.min(max, v)); };
  U.pad2 = function (n) { return (n < 10 ? '0' : '') + n; };

  U.bytesToStr = function (b) {
    if (b == null || isNaN(b)) return '0 B';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
    return (b / 1073741824).toFixed(2) + ' GB';
  };

  /* ============================================================
     Dates. Storage format: ISO strings. Date-only: 'YYYY-MM-DD'.
     ============================================================ */
  U.todayStr = function () {
    var d = new Date();
    return d.getFullYear() + '-' + U.pad2(d.getMonth() + 1) + '-' + U.pad2(d.getDate());
  };

  /* 'YYYY-MM-DD' or Date -> local Date at midnight */
  U.parseDay = function (str) {
    if (!str) return null;
    var m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    var d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  };

  U.dateStr = function (d) {
    return d.getFullYear() + '-' + U.pad2(d.getMonth() + 1) + '-' + U.pad2(d.getDate());
  };

  U.addDays = function (d, days) {
    var r = new Date(d.getTime());
    r.setDate(r.getDate() + days);
    return r;
  };

  U.addMinutes = function (d, mins) {
    var r = new Date(d.getTime());
    r.setMinutes(r.getMinutes() + mins);
    return r;
  };

  U.startOfDay = function (d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  U.daysBetween = function (a, b) {
    return Math.round((U.startOfDay(b).getTime() - U.startOfDay(a).getTime()) / 86400000);
  };

  /* Convert any stored value (Date | ISO | 'YYYY-MM-DD') to a Date. */
  U.toDate = function (v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v === 'number') return new Date(v);
    var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };

  /* Format a date per the current dateFormat setting. */
  U.fmtDate = function (v) {
    var d = U.toDate(v);
    if (!d) return '\u2014';
    var s = MTA.state && MTA.state.settings ? MTA.state.settings.calendar.dateFormat : 'YYYY-MM-DD';
    var yyyy = d.getFullYear(), mm = U.pad2(d.getMonth() + 1), dd = U.pad2(d.getDate());
    if (s === 'MM-DD-YYYY') return mm + '-' + dd + '-' + yyyy;
    if (s === 'DD-MM-YYYY') return dd + '-' + mm + '-' + yyyy;
    return yyyy + '-' + mm + '-' + dd;
  };

  U.fmtTime = function (v) {
    var d = U.toDate(v);
    if (!d) return '';
    var s = MTA.state && MTA.state.settings ? MTA.state.settings.calendar.timeFormat : '24h';
    var h = d.getHours(), m = U.pad2(d.getMinutes());
    if (s === '12h') {
      var ap = h >= 12 ? ' PM' : ' AM';
      var hh = h % 12; if (hh === 0) hh = 12;
      return hh + ':' + m + ap;
    }
    return U.pad2(h) + ':' + m;
  };

  U.fmtDateTime = function (v) {
    var d = U.toDate(v);
    if (!d) return '\u2014';
    return U.fmtDate(d) + ' ' + U.fmtTime(d);
  };

  U.timeAgo = function (v) {
    var d = U.toDate(v);
    if (!d) return '';
    var diff = Date.now() - d.getTime();
    var min = Math.floor(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return min + 'm ago';
    var hr = Math.floor(min / 60);
    if (hr < 24) return hr + 'h ago';
    var dy = Math.floor(hr / 24);
    if (dy < 7) return dy + 'd ago';
    if (dy < 30) return Math.floor(dy / 7) + 'w ago';
    var mo = Math.floor(dy / 30);
    if (mo < 12) return mo + 'mo ago';
    return Math.floor(mo / 12) + 'y ago';
  };

  /* Relative deadline label for a 'YYYY-MM-DD' value. */
  U.deadlineLabel = function (dayStr, now) {
    var d = U.parseDay(dayStr);
    if (!d) return {};
    now = now || new Date();
    var diff = U.daysBetween(now, d);
    if (diff < 0) return { text: Math.abs(diff) + 'd overdue', cls: 'overdue' };
    if (diff === 0) return { text: 'Today', cls: 'soon' };
    if (diff === 1) return { text: 'Tomorrow', cls: 'soon' };
    if (diff <= 7) return { text: 'in ' + diff + 'd', cls: 'soon' };
    return { text: U.fmtDate(d), cls: '' };
  };

  U.monthName = function (m) {
    return ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'][m];
  };

  U.shortDayName = function (dow, startMon) {
    var arr = startMon
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return arr[(dow + (startMon ? 6 : 0)) % 7];
  };

  /* ---------- Misc ---------- */
  U.debounce = function (fn, wait) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  };

  U.download = function (filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 60);
  };

  U.readFile = function (file) {
    return new Promise(function (resolve, reject) {
      var rd = new FileReader();
      rd.onload = function () { resolve(rd.result); };
      rd.onerror = function () { reject(rd.error); };
      rd.readAsText(file);
    });
  };

  /* ---------- Avatars ---------- */
  var AVATAR_COLORS = [
    ['#55715e', '#70917a'], ['#5f7c9e', '#7f9cbb'], ['#a25f55', '#bd7b72'],
    ['#766a9c', '#9688bd'], ['#4d818c', '#6ca0ab'], ['#b9823f', '#d09c5b'],
    ['#8a6f4a', '#a98a63'], ['#5c5f89', '#7d80ab']
  ];

  U.initials = function (name) {
    var s = String(name || '?').trim();
    var parts = s.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  U.avatarColor = function (seed) {
    var h = 0;
    var s = String(seed || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  };

  /* ---------- Sort ---------- */
  U.byKey = function (arr, key, dir) {
    var d = dir === 'asc' ? 1 : -1;
    return arr.slice().sort(function (a, b) {
      var av = a[key], bv = b[key];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -d;
      if (av > bv) return d;
      return 0;
    });
  };

  MTA.utils = U;
})(typeof window !== 'undefined' ? window : this);