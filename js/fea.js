// Hero viewport: a live static-structural "solve" of a steel cantilever.
// Euler–Bernoulli beam theory for deflection and bending stress, plus a local bearing term under the load.
(function () {
  var canvas = document.getElementById("fea");
  if (!canvas) return;
  var C = window.CAE;

  var L = 240, H = 60, B = 20, E = 200000;          // mm, MPa
  var I = (B * H * H * H) / 12;                      // mm^4
  var FMIN = 1000, FMAX = 10000;                     // N
  var NX = 48, NY = 10, BANDS = 9;
  var DMAX = (FMAX * L * L * L) / (3 * E * I);       // tip deflection at full load, mm

  var a = L, F = 5000, ta = L, tF = 5000, pointer = false;
  var geom = null, lastOut = 0;
  var out = {
    pos: document.getElementById("fea-pos"),
    force: document.getElementById("fea-force"),
    stress: document.getElementById("fea-stress"),
    def: document.getElementById("fea-def")
  };

  function defl(x) {
    return x <= a ? (F * x * x * (3 * a - x)) / (6 * E * I) : (F * a * a * (3 * x - a)) / (6 * E * I);
  }
  // y measured from the bottom fibre, 0..H
  function stress(x, y) {
    var M = x < a ? F * (a - x) : 0;
    var s = Math.abs((M * (y - H / 2)) / I);
    var dx = x - a, dy = H - y;
    s += (F / (B * 8)) * Math.exp(-(dx * dx + dy * dy) / 90);
    return s;
  }

  function layout(w, h) {
    var legendW = w < 460 ? 82 : 116;
    var left = legendW + 30, right = 24;
    var sc = (w - left - right) / L;
    var bh = H * sc;
    var yTop = Math.max(58, h * 0.36 - bh / 2);
    geom = { left: left, sc: sc, bh: bh, yTop: yTop, w: w, h: h, legendW: legendW };
  }

  function draw(ctx, w, h, t) {
    var col = C.colors();
    if (!pointer && !C.reduce) {
      ta = L * (0.62 + 0.38 * (0.5 + 0.5 * Math.sin(t * 0.45)));
      tF = FMIN + (FMAX - FMIN) * (0.5 + 0.32 * Math.sin(t * 0.7 + 1));
    }
    if (C.reduce) { a = ta; F = tF; } else { a += (ta - a) * 0.12; F += (tF - F) * 0.12; }
    layout(w, h);
    var g = geom, sc = g.sc;
    var k = (0.85 * H) / DMAX; // display magnification

    var bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, col.bg1);
    bg.addColorStop(1, col.bg2);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // element stresses
    var vals = new Float32Array(NX * NY), smax = 0;
    for (var i = 0; i < NX; i++) {
      for (var j = 0; j < NY; j++) {
        var s = stress(((i + 0.5) * L) / NX, ((j + 0.5) * H) / NY);
        vals[i * NY + j] = s;
        if (s > smax) smax = s;
      }
    }
    function px(x) { return g.left + x * sc; }
    function py(x, y) { return g.yTop + (H - y) * sc + defl(x) * k * sc; }

    // undeformed outline
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = col.ink2;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1;
    ctx.strokeRect(g.left, g.yTop, L * sc, g.bh);
    ctx.restore();

    // deformed mesh
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = col.mesh;
    for (i = 0; i < NX; i++) {
      var x0 = (i * L) / NX, x1 = ((i + 1) * L) / NX;
      for (j = 0; j < NY; j++) {
        var y0 = (j * H) / NY, y1 = ((j + 1) * H) / NY;
        ctx.beginPath();
        ctx.moveTo(px(x0), py(x0, y0));
        ctx.lineTo(px(x1), py(x1, y0));
        ctx.lineTo(px(x1), py(x1, y1));
        ctx.lineTo(px(x0), py(x0, y1));
        ctx.closePath();
        ctx.fillStyle = C.jet(C.band(vals[i * NY + j] / smax, BANDS));
        ctx.fill();
        ctx.stroke();
      }
    }

    // fixed support
    var sx = g.left - 14, sy = g.yTop - 12, sh = g.bh + 24;
    ctx.fillStyle = col.support;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(sx, sy, 14, sh);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = col.support;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var hy = sy; hy < sy + sh; hy += 7) { ctx.moveTo(sx, hy + 7); ctx.lineTo(sx + 14, hy); }
    ctx.moveTo(sx + 14, sy); ctx.lineTo(sx + 14, sy + sh);
    ctx.stroke();

    // force arrow
    var ax = px(a), ay = py(a, H);
    ctx.strokeStyle = col.load;
    ctx.fillStyle = col.load;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(ax, ay - 50);
    ctx.lineTo(ax, ay - 9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax, ay - 2);
    ctx.lineTo(ax - 6, ay - 12);
    ctx.lineTo(ax + 6, ay - 12);
    ctx.closePath();
    ctx.fill();

    // tags in the solver's style
    ctx.font = "500 11px " + col.mono;
    tag(ctx, col, sx, sy - 10, "A", "Fixed Support", col.support, "left");
    var fl = "Force " + (F / 1000).toFixed(1) + " kN";
    tag(ctx, col, ax, ay - 56, "B", fl, col.load, ax > w - 150 ? "right" : "left");

    // max probe at the root
    var mx = px(0), my = g.yTop + g.bh + 18;
    ctx.fillStyle = col.panel;
    ctx.strokeStyle = col.ink;
    ctx.lineWidth = 1;
    var mt = "Max " + smax.toFixed(1) + " MPa";
    var mw = ctx.measureText(mt).width + 12;
    ctx.beginPath();
    ctx.moveTo(mx + 2, g.yTop + g.bh);
    ctx.lineTo(mx + 10, my);
    ctx.stroke();
    ctx.fillRect(mx + 10, my, mw, 18);
    ctx.strokeRect(mx + 10, my, mw, 18);
    ctx.fillStyle = col.ink;
    ctx.fillText(mt, mx + 16, my + 13);

    legend(ctx, col, smax, g);
    triad(ctx, col, w - 46, h - 18);

    if (t - lastOut > 0.1 || C.reduce) {
      lastOut = t;
      if (out.pos) out.pos.textContent = a.toFixed(0) + " mm";
      if (out.force) out.force.textContent = (F / 1000).toFixed(2) + " kN";
      if (out.stress) out.stress.textContent = smax.toFixed(1) + " MPa";
      if (out.def) out.def.textContent = defl(L).toFixed(3) + " mm";
    }
  }

  function tag(ctx, col, x, y, letter, text, color, align) {
    var w = ctx.measureText(text).width;
    var bx = align === "right" ? x - w - 30 : x;
    ctx.fillStyle = color;
    ctx.fillRect(bx, y - 13, 18, 18);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(letter, bx + 5, y);
    ctx.fillStyle = col.ink;
    ctx.fillText(text, bx + 24, y);
  }

  function legend(ctx, col, smax, g) {
    var x = 14, y = 16, bw = 16, bh = g.h < 340 ? 15 : 19;
    ctx.fillStyle = col.ink;
    ctx.font = "600 11px " + col.body;
    ctx.fillText(g.legendW > 100 ? "Equivalent Stress" : "Eqv. Stress", x, y + 2);
    ctx.font = "400 10px " + col.mono;
    ctx.fillStyle = col.ink2;
    ctx.fillText("Unit: MPa", x, y + 16);
    var top = y + 28;
    for (var n = 0; n < BANDS; n++) {
      ctx.fillStyle = C.jet((BANDS - 1 - n) / (BANDS - 1));
      ctx.fillRect(x, top + n * bh, bw, bh);
    }
    ctx.strokeStyle = col.mesh;
    ctx.strokeRect(x, top, bw, bh * BANDS);
    ctx.fillStyle = col.ink;
    for (n = 0; n <= BANDS; n++) {
      var v = smax * (1 - n / BANDS);
      var label = v.toFixed(v >= 100 ? 0 : 1);
      if (n === 0) label += " Max";
      if (n === BANDS) label = "0 Min";
      ctx.fillText(label, x + bw + 6, top + n * bh + 4);
    }
  }

  function triad(ctx, col, x, y) {
    ctx.lineWidth = 1.6;
    ctx.font = "600 10px " + col.mono;
    ctx.strokeStyle = "#e5484d"; ctx.fillStyle = "#e5484d";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 24, y); ctx.stroke(); ctx.fillText("X", x + 27, y + 4);
    ctx.strokeStyle = "#30a46c"; ctx.fillStyle = "#30a46c";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 24); ctx.stroke(); ctx.fillText("Y", x - 3, y - 28);
    ctx.strokeStyle = "#3e63dd"; ctx.fillStyle = "#3e63dd";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 13, y + 9); ctx.stroke(); ctx.fillText("Z", x - 24, y + 12);
  }

  var view = C.loop(canvas, draw);

  function fromPointer(e) {
    if (!geom) return;
    var r = canvas.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    ta = C.clamp((x - geom.left) / geom.sc, L * 0.15, L);
    var frac = C.clamp((y - (geom.yTop - 40)) / (geom.h - geom.yTop + 20), 0, 1);
    tF = FMIN + frac * (FMAX - FMIN);
    pointer = true;
    view.redraw();
  }
  canvas.addEventListener("pointermove", fromPointer);
  canvas.addEventListener("pointerdown", fromPointer);
  canvas.addEventListener("pointerleave", function () { pointer = false; });

  // Keyboard: arrows move the load and change the force
  canvas.addEventListener("keydown", function (e) {
    var used = true;
    if (e.key === "ArrowLeft") ta = C.clamp(ta - 10, L * 0.15, L);
    else if (e.key === "ArrowRight") ta = C.clamp(ta + 10, L * 0.15, L);
    else if (e.key === "ArrowUp") tF = C.clamp(tF + 500, FMIN, FMAX);
    else if (e.key === "ArrowDown") tF = C.clamp(tF - 500, FMIN, FMAX);
    else used = false;
    if (used) { pointer = true; e.preventDefault(); view.redraw(); }
  });
  canvas.addEventListener("blur", function () { pointer = false; });
})();
