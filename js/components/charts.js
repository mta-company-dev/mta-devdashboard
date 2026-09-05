/* ============================================================
   MTA DevDashboard - components/charts.js
   Lightweight canvas chart renderer (line, bar, doughnut).
   No external libraries. Reads colors from CSS variables.
   ============================================================ */
(function (global) {
  'use strict';
  var MTA = (global.MTA = global.MTA || {});
  var U = MTA.utils;
  var CH = {};

  var registry = [];

  function cssVar(name) {
    var cs = global.getComputedStyle(document.documentElement);
    return cs.getPropertyValue(name).trim() || '#888';
  }

  function chartColors() {
    var arr = [];
    for (var i = 1; i <= 6; i++) arr.push(cssVar('--chart-' + i));
    return arr;
  }

  function textColors() {
    return {
      text1: cssVar('--text-1'),
      text2: cssVar('--text-2'),
      grid: cssVar('--chart-grid')
    };
  }

  function setupCanvas(canvas, height) {
    var parent = canvas.parentNode;
    var w = parent ? parent.clientWidth : canvas.clientWidth;
    if (w < 10) w = 300;
    var h = height || 220;
    var dpr = global.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  /* Minimal tooltip helper. */
  function tip(text, x, y, canvas) {
    var old = document.getElementById('mta-chart-tip');
    if (old) old.remove();
    var div = document.createElement('div');
    div.id = 'mta-chart-tip';
    div.innerHTML = text;
    var cs = getComputedStyle(document.documentElement);
    div.style.cssText =
      'position:fixed;z-index:1200;pointer-events:none;background:' + cs.getPropertyValue('--surface-1') +
      ';color:' + cs.getPropertyValue('--text-1') +
      ';border:1px solid ' + cs.getPropertyValue('--border') +
      ';border-radius:8px;padding:6px 10px;font-size:12px;box-shadow:' +
      cs.getPropertyValue('--shadow-md') + ';transform:translate(12px,-50%);white-space:nowrap;';
    document.body.appendChild(div);
    var r = canvas.getBoundingClientRect();
    div.style.left = (r.left + x + 6) + 'px';
    div.style.top = (r.top + y) + 'px';
    return div;
  }

  function rmTip() {
    var old = document.getElementById('mta-chart-tip');
    if (old) old.remove();
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function axisTicks(max, count) {
    var nice = Math.pow(10, Math.floor(Math.log(Math.max(max, 1)) / Math.LN10));
    var step = Math.ceil(max / count / nice) * nice;
    if (step < 1) step = 1;
    var out = [];
    for (var v = 0; v <= max; v += step) out.push(v);
    if (out.length < 2) out = [0, max || 1];
    return out;
  }

  function register(chart) {
    registry.push(chart);
  }

  CH.redrawAll = function () {
    registry.slice().forEach(function (c) {
      try { c.redraw(); } catch (e) { /* ignore */ }
    });
  };

  /* ---------- Line chart ---------- */
  CH.line = function (canvas, opts) {
    opts = opts || {};
    var height = opts.height || 230;

    function draw() {
      var t = textColors();
      var sc = setupCanvas(canvas, height);
      var ctx = sc.ctx, w = sc.w, h = sc.h;
      ctx.clearRect(0, 0, w, h);

      var labels = opts.labels || [];
      var series = opts.series || [{ data: opts.data || [], color: opts.color || cssVar('--chart-1') }];
      var padL = 38, padR = 14, padT = 14, padB = 26;
      var pw = w - padL - padR, ph = h - padT - padB;

      /* gather max */
      var maxV = 0;
      series.forEach(function (s) {
        (s.data || []).forEach(function (v) { if (v > maxV) maxV = v; });
      });
      var ticks = axisTicks(maxV, 4);
      var maxY = ticks[ticks.length - 1] || 1;

      /* grid + labels */
      ctx.font = '10px ' + cssVar('--font-sans');
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ticks.forEach(function (tk) {
        var y = padT + ph - (ph * tk) / maxY;
        ctx.strokeStyle = t.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillStyle = t.text2;
        ctx.fillText(String(tk), padL - 7, y);
      });

      /* x labels (sample a few) */
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      var labelEvery = Math.max(1, Math.ceil(labels.length / 10));
      labels.forEach(function (lb, i) {
        if (i % labelEvery !== 0) return;
        var x = padL + (pw * i) / Math.max(1, labels.length - 1);
        ctx.fillText(String(lb), x, h - padB + 6);
      });

      /* series */
      series.forEach(function (s, si) {
        var data = s.data || [];
        var color = s.color || chartColors()[si % 6];
        var stepX = data.length > 1 ? pw / (data.length - 1) : 0;

        /* area fill */
        ctx.save();
        ctx.beginPath();
        data.forEach(function (v, i) {
          var x = padL + stepX * i;
          var y = padT + ph - (ph * v) / maxY;
          if (i === 0) ctx.moveTo(x, y);
          else {
            var px = padL + stepX * (i - 1);
            var py = padT + ph - (ph * data[i - 1]) / maxY;
            ctx.quadraticCurveTo(px, y, (px + x) / 2, (py + y) / 2);
          }
        });
        var lastX = padL + stepX * (data.length - 1);
        ctx.lineTo(lastX, padT + ph);
        ctx.lineTo(padL, padT + ph);
        ctx.closePath();
        var grad = ctx.createLinearGradient(0, padT, 0, padT + ph);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.globalAlpha = opts.fillAlpha != null ? opts.fillAlpha : 0.25;
        ctx.fill();
        ctx.restore();

        /* smooth line */
        ctx.save();
        ctx.beginPath();
        data.forEach(function (v, i) {
          var x = padL + stepX * i;
          var y = padT + ph - (ph * v) / maxY;
          if (i === 0) ctx.moveTo(x, y);
          else {
            var px = padL + stepX * (i - 1);
            var py = padT + ph - (ph * data[i - 1]) / maxY;
            ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
          }
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();

        /* dots */
        if (data.length <= 24) {
          data.forEach(function (v, i) {
            var x = padL + stepX * i;
            var y = padT + ph - (ph * v) / maxY;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = t.text1;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          });
        }
      });

      /* hover */
      try {
        canvas.onmousemove = function (e) {
          var r = canvas.getBoundingClientRect();
          var mx = e.clientX - r.left;
          var i = Math.round((mx - padL) / (stepX || 1));
          if (i < 0 || i >= labels.length) { rmTip(); return; }
          var parts = [];
          series.forEach(function (s, si) {
            var v = (s.data || [])[i];
            if (v == null) return;
            parts.push('<b style="color:' + (s.color || chartColors()[si % 6]) + '">' +
              (s.name || 'Series ' + (si + 1)) + ':</b> ' + v);
          });
          parts.unshift('<b>' + U.esc(String(labels[i])) + '</b>');
          tip(parts.join('<br>'), mx, 0, canvas);
        };
        canvas.onmouseleave = rmTip;
      } catch (e) { /* hover optional */ }
    }

    var chart = { type: 'line', canvas: canvas, redraw: draw };
    register(chart);
    draw();
    return chart;
  };

  /* ---------- Bar chart ---------- */
  CH.bar = function (canvas, opts) {
    opts = opts || {};
    var height = opts.height || 230;

    function draw() {
      var t = textColors();
      var sc = setupCanvas(canvas, height);
      var ctx = sc.ctx, w = sc.w, h = sc.h;
      ctx.clearRect(0, 0, w, h);

      var labels = opts.labels || [];
      var datasets = opts.datasets || [{ data: opts.data || [], color: opts.color || cssVar('--chart-1') }];
      var padL = 38, padR = 12, padT = 14, padB = 26;
      var pw = w - padL - padR, ph = h - padT - padB;

      var maxV = 0;
      datasets.forEach(function (d) {
        (d.data || []).forEach(function (v) { if (v > maxV) maxV = v; });
      });
      var ticks = axisTicks(maxV, 4);
      var maxY = ticks[ticks.length - 1] || 1;

      ctx.font = '10px ' + cssVar('--font-sans');
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ticks.forEach(function (tk) {
        var y = padT + ph - (ph * tk) / maxY;
        ctx.strokeStyle = t.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillStyle = t.text2;
        ctx.fillText(String(tk), padL - 7, y);
      });

      var n = labels.length || 1;
      var slot = pw / n;
      var dsCount = datasets.length;
      var bw = Math.min(slot * 0.62, (dsCount > 1 ? slot / dsCount : slot) * 0.72);
      var bwInner = bw / dsCount;

      datasets.forEach(function (d, di) {
        var color = d.color || chartColors()[di % 6];
        (d.data || []).forEach(function (v, i) {
          var bh = (ph * v) / maxY;
          var x = padL + slot * i + (slot - bw) / 2 + bwInner * di;
          var y = padT + ph - bh;
          ctx.beginPath();
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.92;
          roundRect(ctx, x, y, Math.max(2, bwInner - 3), bh, 4);
          ctx.fill();
          ctx.globalAlpha = 1;
          /* highlight top */
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          roundRect(ctx, x, y, Math.max(2, bwInner - 3), Math.min(6, bh), 4);
          ctx.fill();
        });
      });

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      var labelEvery = Math.max(1, Math.ceil(n / 12));
      labels.forEach(function (lb, i) {
        if (i % labelEvery !== 0) return;
        var x = padL + slot * i + slot / 2;
        ctx.fillStyle = t.text2;
        ctx.fillText(String(lb), x, h - padB + 6);
      });

      try {
        canvas.onmousemove = function (e) {
          var r = canvas.getBoundingClientRect();
          var mx = e.clientX - r.left;
          var i = Math.floor((mx - padL) / slot);
          if (i < 0 || i >= labels.length) { rmTip(); return; }
          var parts = ['<b>' + U.esc(String(labels[i])) + '</b>'];
          datasets.forEach(function (d, di) {
            var v = (d.data || [])[i];
            if (v == null) return;
            parts.push('<b style="color:' + (d.color || chartColors()[di % 6]) + '">' +
              (d.name || 'Value') + ':</b> ' + v);
          });
          tip(parts.join('<br>'), mx, 0, canvas);
        };
        canvas.onmouseleave = rmTip;
      } catch (e) { /* optional */ }
    }

    var chart = { type: 'bar', canvas: canvas, redraw: draw };
    register(chart);
    draw();
    return chart;
  };

  /* ---------- Doughnut ---------- */
  CH.doughnut = function (canvas, opts) {
    opts = opts || {};
    var height = opts.height || 210;
    var centerText = opts.centerText || '';

    function draw() {
      var t = textColors();
      var sc = setupCanvas(canvas, height);
      var ctx = sc.ctx, w = sc.w, h = sc.h;
      ctx.clearRect(0, 0, w, h);

      var labels = opts.labels || [];
      var values = opts.values || [];
      var colors = opts.colors || chartColors();
      var total = values.reduce(function (a, b) { return a + (b > 0 ? b : 0); }, 0);

      if (total === 0) {
        ctx.fillStyle = t.text2;
        ctx.font = '12px ' + cssVar('--font-sans');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No data yet', w / 2, h / 2);
        return;
      }

      var cx = w / 2, cy = h / 2;
      var radius = Math.min(w, h) / 2 - 8;
      var inner = radius * 0.62;
      var startA = -Math.PI / 2;

      var prev = startA;
      var segs = [];
      values.forEach(function (v, i) {
        var angle = (v / total) * Math.PI * 2;
        var midA = prev + angle / 2;
        segs.push({ start: prev, end: prev + angle, mid: midA, color: colors[i % colors.length], label: labels[i], value: v });
        prev += angle;
      });

      segs.forEach(function (seg) {
        ctx.beginPath();
        ctx.moveTo(cx + inner * Math.cos(seg.start), cy + inner * Math.sin(seg.start));
        ctx.arc(cx, cy, radius, seg.start, seg.end);
        ctx.arc(cx, cy, inner, seg.end, seg.start, true);
        ctx.closePath();
        ctx.fillStyle = seg.color;
        ctx.fill();
        /* subtle edge */
        ctx.strokeStyle = cssVar('--surface-1');
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      /* center text */
      if (centerText) {
        ctx.textAlign = 'center';
        ctx.fillStyle = t.text1;
        ctx.font = '700 20px ' + cssVar('--font-sans');
        ctx.textBaseline = 'middle';
        ctx.fillText(centerText, cx, cy - 6);
        ctx.fillStyle = t.text2;
        ctx.font = '10px ' + cssVar('--font-sans');
        ctx.fillText(opts.centerSub || '', cx, cy + 12);
      }

      try {
        canvas.onmousemove = function (e) {
          var r = canvas.getBoundingClientRect();
          var x = e.clientX - r.left - cx;
          var y = e.clientY - r.top - cy;
          var dist = Math.sqrt(x * x + y * y);
          if (dist < inner || dist > radius) { rmTip(); return; }
          var a = Math.atan2(y, x);
          if (a < -Math.PI / 2) a += Math.PI * 2;
          var found = null;
          for (var i = 0; i < segs.length; i++) {
            var s = segs[i];
            var sa = s.start < -Math.PI / 2 ? s.start + Math.PI * 2 : s.start;
            var ea = s.end < -Math.PI / 2 ? s.end + Math.PI * 2 : s.end;
            if (a >= sa && a <= ea) { found = s; break; }
          }
          if (!found) { rmTip(); return; }
          tip('<b style="color:' + found.color + '">' + U.esc(String(found.label)) + '</b>: ' + found.value +
            ' (' + Math.round((found.value / total) * 100) + '%)', x + 0, y + 0, canvas);
        };
        canvas.onmouseleave = rmTip;
      } catch (e) { /* optional */ }
    }

    var chart = { type: 'doughnut', canvas: canvas, redraw: draw };
    register(chart);
    draw();
    return chart;
  };

  /* Watch container resize so charts stay crisp. */
  CH.attachResize = function (canvas) {
    if (!global.ResizeObserver) return;
    try {
      var ro = new global.ResizeObserver(function () {
        registry.forEach(function (c) {
          if (c.canvas === canvas) c.redraw();
        });
      });
      ro.observe(canvas.parentNode || canvas);
    } catch (e) { /* ignore */ }
  };

  MTA.charts = CH;
  MTA.state && MTA.state.on && MTA.state.on('theme', function () {
    setTimeout(CH.redrawAll, 60);
  });
})(typeof window !== 'undefined' ? window : this);