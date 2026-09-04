/* ============================================================
   MTA DevDashboard - components/editor.js
   Rich text editor for DevNote (contentEditable + live selection
   tracking + undo/redo stack). No external libraries.
   ============================================================ */
(function (global) {
  'use strict';
  var MTA = (global.MTA = global.MTA || {});
  var U = MTA.utils;
  var E = {};

  var SVG = {
    bold: '<svg class="ic-sm" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h6a4 4 0 0 1 0 8H7zM7 13h7a4 4 0 0 1 0 8H7z"/></svg>',
    italic: '<svg class="ic-sm" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4h10M8 20h10M14 4L10 20"/></svg>',
    underline: '<svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v7a6 6 0 0 0 12 0V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>',
    strike: '<svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4H9a3 3 0 0 0-2.8 4M6 20h7a3 3 0 0 0 2.4-5"/><line x1="3" y1="12" x2="21" y2="12"/></svg>',
    quote: '<svg class="ic-sm" viewBox="0 0 24 24" fill="currentColor"><path d="M10 8c-3 0-5 2-5 5v3h5v-5H8c0-2 2-3 2-3zm9 0c-3 0-5 2-5 5v3h5v-5h-2c0-2 2-3 2-3z"/></svg>',
    code: '<svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    link: '<svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    listUl: '<svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1.4"/><circle cx="3" cy="12" r="1.4"/><circle cx="3" cy="18" r="1.4"/></svg>',
    listOl: '<svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4M4 10h2M4 14c0-1 2-1 2-2s-2-1-2-2M4 18h2M6 16c0 1 0 2-1 2"/></svg>',
    task: '<svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    table: '<svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
    undo: '<svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    redo: '<svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg>',
    left: '<svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="14" y2="12"/><line x1="3" y1="18" x2="10" y2="18"/></svg>',
    center: '<svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="6" x2="18" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="6" y1="18" x2="18" y2="18"/></svg>',
    right: '<svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="7" y1="18" x2="21" y2="18"/></svg>',
    h1: '<b class="rte-hb">H1</b>',
    h2: '<b class="rte-hb">H2</b>',
    h3: '<b class="rte-hb">H3</b>',
    block: '<svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 4l-6 8 6 8M16 4l6 8-6 8"/></svg>',
    fontMinus: '<svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 6v12"/><line x1="6" y1="12" x2="18" y2="12"/></svg>',
    fontPlus: '<svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21c2-6 14-6 16 0"/><path d="M12 5v8"/><line x1="8" y1="9" x2="16" y2="9"/></svg>'
  };
  /* ---------- Command helpers ---------- */
  function saveSelection(el) {
    var sel = global.getSelection();
    if (sel && sel.rangeCount) {
      var range = sel.getRangeAt(0);
      if (el.contains(range.commonAncestorContainer)) {
        return { start: range.startOffset, end: range.endOffset, root: range.commonAncestorContainer };
      }
    }
    return null;
  }

  function exec(cmd, value) {
    /* keypoint: browser execCommand still works and is the zero-dependency way */
    try {
      document.execCommand(cmd, false, value == null ? null : value);
    } catch (err) {
      console.warn('execCommand ' + cmd + ' failed', err);
    }
  }

  function queryState(cmd) {
    try { return document.queryCommandState(cmd); } catch (e) { return false; }
  }

  /* ---------- Toolbar button ---------- */
  function btn(label, html, onClick, extraCls) {
    var b = U.el('button', {
      class: 'rte-btn ' + (extraCls || ''),
      type: 'button', 'aria-label': label, title: label, html: html
    });
    b.addEventListener('click', function (e) {
      e.preventDefault();
      onClick();
      var r = b.parentNode && b.parentNode.parentNode.querySelector('.rte');
      if (r) r.focus();
    });
    return b;
  }

  function sep() {
    var s = U.el('span', { class: 'rte-sep', 'aria-hidden': 'true' });
    return s;
  }

  function colorSwatchBtn(title, color, onPick) {
    var label = U.el('label', {
      class: 'rte-btn', title: title, 'aria-label': title
    });
    label.style.cssText = 'width:auto;cursor:pointer;gap:4px;';
    var sw = U.el('span', {
      style: 'display:inline-block;width:13px;height:13px;border-radius:50%;background:' + color + ';border:1px solid var(--border-strong);'
    });
    var inp = U.el('input', {
      type: 'color', value: color, 'aria-label': title,
      style: 'position:absolute;width:1px;height:1px;opacity:0;'
    });
    label.appendChild(sw);
    label.appendChild(inp);
    inp.addEventListener('input', function () {
      sw.style.background = inp.value;
      onPick(inp.value);
    });
    return label;
  }

  /* ---------- Build toolbar ---------- */
  function stateBtn(cmd, label, html, extraCls) {
    var b = btn(label, html, function () { exec(cmd); }, extraCls);
    return b;
  }

  function buildToolbar(rte, onAction, editorApi) {
    var bar = U.el('div', { class: 'rte-toolbar', role: 'toolbar', 'aria-label': 'Formatting' });

    var bH1 = btn('Heading 1', SVG.h1, function () {
      exec('formatBlock', 'H1');
    }, 'heading');
    var bH2 = btn('Heading 2', SVG.h2, function () { exec('formatBlock', 'H2'); }, 'heading');
    var bH3 = btn('Heading 3', SVG.h3, function () { exec('formatBlock', 'H3'); }, 'heading');
    var bBold = stateBtn('bold', 'Bold', SVG.bold, 'bold');
    var bItalic = stateBtn('italic', 'Italic', SVG.italic, 'italic');
    var bUnder = stateBtn('underline', 'Underline', SVG.underline, 'underline');
    var bStrike = stateBtn('strikeThrough', 'Strikethrough', SVG.strike, 'strike');
    var bQuote = btn('Quote', SVG.quote, function () { exec('formatBlock', 'BLOCKQUOTE'); });
    var bCode = btn('Inline code', SVG.code, function () { exec('formatBlock', 'PRE'); });
    var bLink = btn('Link', SVG.link, function () {
      var href = prompt('Link URL:', 'https://');
      if (href) exec('createLink', href);
    });
    var bUl = stateBtn('insertUnorderedList', 'Bulleted list', SVG.listUl);
    var bOl = stateBtn('insertOrderedList', 'Numbered list', SVG.listOl);
    var bTask = btn('Checklist', SVG.task, function () {
      if (rte) {
        rte.focus();
        exec('insertHTML', '<div class="task-item"><input type="checkbox"> <span>&nbsp;</span></div>');
      }
    });
    var bTable = btn('Insert table', SVG.table, function () {
      exec('insertHTML',
        '<table><thead><tr><th>Item</th><th>Value</th></tr></thead>' +
        '<tbody><tr><td><br></td><td><br></td></tr></tbody></table>');
    });
    var bLikeUndo = btn('Undo', SVG.undo, function () { exec('undo'); });
    var bRedo = btn('Redo', SVG.redo, function () { exec('redo'); });
    var bAlignL = btn('Align left', SVG.left, function () { exec('justifyLeft'); });
    var bAlignC = btn('Align center', SVG.center, function () { exec('justifyCenter'); });
    var bAlignR = btn('Align right', SVG.right, function () { exec('justifyRight'); });
    var bFmtMinus = btn('Decrease font size', SVG.fontMinus, function () {
      exec('fontSize', '2');
    });
    var bFmtPlus = btn('Increase font size', SVG.fontPlus, function () {
      exec('fontSize', '5');
    });
    var bColor = colorSwatchBtn('Text color', '#29241c', function (c) {
      exec('foreColor', c);
    });
    var bHilite = colorSwatchBtn('Highlight color', '#f2d27b', function (c) {
      exec('hiliteColor', c);
    });

    var groups = [
      [bLikeUndo, bRedo],
      [bH1, bH2, bH3],
      [bBold, bItalic, bUnder, bStrike],
      [bColor, bHilite],
      [bFmtMinus, bFmtPlus],
      [bAlignL, bAlignC, bAlignR],
      [bUl, bOl, bTask],
      [bQuote, bCode, bLink, bTable]
    ];
    groups.forEach(function (g, i) {
      g.forEach(function (el) { bar.appendChild(el); });
      if (i < groups.length - 1) bar.appendChild(sep());
    });

    /* refresh active states */
    function refresh() {
      bBold.classList.toggle('on', queryState('bold'));
      bItalic.classList.toggle('on', queryState('italic'));
      bUnder.classList.toggle('on', queryState('underline'));
      bStrike.classList.toggle('on', queryState('strikeThrough'));
      bUl.classList.toggle('on', queryState('insertUnorderedList'));
      bOl.classList.toggle('on', queryState('insertOrderedList'));
    }
    rte.addEventListener('keyup', refresh);
    rte.addEventListener('mouseup', refresh);
    rte.addEventListener('click', refresh);

    return { bar: bar, refresh: refresh };
  }

  /* ---------- Create editor ---------- */
  /* Returns: { root, title, subtitle, rte, toolbar, getValue, setValue, setData, destroy } */
  E.create = function (opts) {
    opts = opts || {};
    var container = opts.container;
    var root = U.el('div', { class: 'note-editor', id: opts.id || ('editor_' + U.uid('e')) });

    /* Title + subtitle */
    var title = U.el('input', {
      class: 'note-title-input', type: 'text',
      placeholder: 'Note title...', 'aria-label': 'Note title'
    });
    var sub = U.el('input', {
      class: 'note-sub-input', type: 'text',
      placeholder: 'Subtitle (optional)', 'aria-label': 'Note subtitle'
    });
    title.addEventListener('input', function () { if (opts.onChange) opts.onChange(); });
    sub.addEventListener('input', function () { if (opts.onChange) opts.onChange(); });

    /* Toolbar + body */
    var rte = U.el('div', {
      class: 'rte rte-content', contenteditable: 'true',
      'aria-label': 'Note content', spellcheck: 'true',
      html: '<p><br></p>'
    });
    var toolbar = buildToolbar(rte, null, null);

    /* keyboard shortcuts inside editor */
    rte.addEventListener('keydown', function (e) {
      var mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'b') { e.preventDefault(); exec('bold'); }
      if (mod && e.key === 'i') { e.preventDefault(); exec('italic'); }
      if (mod && e.key === 'u') { e.preventDefault(); exec('underline'); }
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); exec('undo'); }
      if (mod && e.key === 'y') { e.preventDefault(); exec('redo'); }
      if (mod && e.shiftKey && e.key === 'Z') { e.preventDefault(); exec('redo'); }
    });
    rte.addEventListener('input', function () {
      if (opts.onChange) opts.onChange();
    });

    root.appendChild(toolbar.bar);
    root.appendChild(title);
    root.appendChild(sub);
    root.appendChild(U.el('div', { class: 'sr-only' }));
    root.appendChild(rte);

    if (container) container.appendChild(root);

    return {
      root: root,
      title: title,
      subtitle: sub,
      rte: rte,
      toolbar: toolbar,
      getTitle: function () { return title.value.trim(); },
      getSubtitle: function () { return sub.value.trim(); },
      getHTML: function () {
        var h = rte.innerHTML;
        if (h === '<br>' || h === '' || h === '<p><br></p>') return '';
        return h;
      },
      setData: function (data) {
        title.value = (data && data.title) || '';
        sub.value = (data && data.subtitle) || '';
        rte.innerHTML = (data && data.content) ? data.content : '<p><br></p>';
      },
      getData: function () {
        return { title: title.value, subtitle: sub.value, content: rte.innerHTML };
      },
      focusBody: function () { rte.focus(); },
      destroy: function () { if (root.parentNode) root.parentNode.removeChild(root); }
    };
  };

  MTA.editor = E;
})(typeof window !== 'undefined' ? window : this);