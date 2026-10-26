// Modal analysis demo: the first three bending modes of a steel cantilever (Euler–Bernoulli).
(function () {
  var canvas = document.getElementById("modes");
  if (!canvas) return;
  var C = window.CAE;

  var BETA = [1.8751, 4.6941, 7.8548];
  // Steel cantilever 300 x 40 x 10 mm
  var Lm = 0.3, b = 0.04, hgt = 0.01, Em = 200e9, rho = 7850;
  var EI = (Em * b * hgt * hgt * hgt) / 12, rhoA = rho * b * hgt;
  var FREQ = BETA.map(function (bl) { return ((bl * bl) / (2 * Math.PI * Lm * Lm)) * Math.sqrt(EI / rhoA); });

  var mode = 0, NX = 64, NY = 3;
  var shapes = BETA.map(function (bl) {
    var s = (Math.cosh(bl) + Math.cos(bl)) / (Math.sinh(bl) + Math.sin(bl));
    var arr = [], max = 0;
    for (var i = 0; i <= NX; i++) {
      var x = (bl * i) / NX;
      var v = Math.cosh(x) - Math.cos(x) - s * (Math.sinh(x) - Math.sin(x));
      arr.push(v);
      max = Math.max(max, Math.abs(v));
    }
    return arr.map(function (v) { return v / max; });
  });
  var nodes = shapes.map(function (arr) {
    var n = [];
    for (var i = 2; i <= NX; i++) if (arr[i - 1] * arr[i] < 0) n.push((i - 0.5) / NX);
    return n;
  });

  var freqOut = document.getElementById("mode-freq");
  var buttons = document.querySelectorAll("[data-mode]");

  function draw(ctx, w, h, t) {
    var col = C.colors();
    var bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, col.bg1);
    bg.addColorStop(1, col.bg2);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    var left = 40, right = 24, len = w - left - right;
    var th = Math.max(10, Math.min(16, h * 0.06));
    var cy = h * 0.5, amp = h * 0.3;
    var phase = C.reduce ? 1 : Math.sin(t * 2 * Math.PI * 0.55);
    var shape = shapes[mode];
    function y(i) { return cy - shape[i] * amp * phase; }

    // axis + undeformed outline
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = col.ink2;
    ctx.globalAlpha = 0.55;
    ctx.strokeRect(left, cy - th / 2, len, th);
    ctx.restore();

    ctx.lineWidth = 0.5;
    ctx.strokeStyle = col.mesh;
    for (var i = 0; i < NX; i++) {
      var x0 = left + (len * i) / NX, x1 = left + (len * (i + 1)) / NX;
      var mag = Math.abs((shape[i] + shape[i + 1]) / 2 * phase);
      ctx.fillStyle = C.jet(C.band(mag, 9));
      for (var j = 0; j < NY; j++) {
        var o0 = -th / 2 + (th * j) / NY, o1 = -th / 2 + (th * (j + 1)) / NY;
        ctx.beginPath();
        ctx.moveTo(x0, y(i) + o0);
        ctx.lineTo(x1, y(i + 1) + o0);
        ctx.lineTo(x1, y(i + 1) + o1);
        ctx.lineTo(x0, y(i) + o1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // nodes
    ctx.font = "500 10px " + col.mono;
    nodes[mode].forEach(function (n) {
      var nx = left + n * len;
      ctx.strokeStyle = col.ink;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(nx, cy, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = col.ink2;
      ctx.fillText("node", nx - 12, cy + th + 18);
    });

    // fixed support
    ctx.strokeStyle = col.support;
    ctx.fillStyle = col.support;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(left - 14, cy - 40, 14, 80);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var hy = cy - 40; hy < cy + 40; hy += 7) { ctx.moveTo(left - 14, hy + 7); ctx.lineTo(left, hy); }
    ctx.moveTo(left, cy - 40); ctx.lineTo(left, cy + 40);
    ctx.stroke();

    ctx.fillStyle = col.ink;
    ctx.font = "600 11px " + col.body;
    ctx.fillText("Total Deformation · Mode " + (mode + 1), 14, 20);
    ctx.font = "400 10px " + col.mono;
    ctx.fillStyle = col.ink2;
    ctx.fillText("Normalised · f = " + FREQ[mode].toFixed(1) + " Hz", 14, 35);
  }

  var view = C.loop(canvas, draw);

  function setMode(m) {
    mode = m;
    buttons.forEach(function (btn) { btn.setAttribute("aria-pressed", String(Number(btn.dataset.mode) === m)); });
    if (freqOut) freqOut.textContent = FREQ[m].toFixed(1) + " Hz";
    view.redraw();
  }
  buttons.forEach(function (btn) {
    var m = Number(btn.dataset.mode);
    var f = btn.querySelector(".f");
    if (f) f.textContent = FREQ[m].toFixed(0) + " Hz";
    btn.addEventListener("click", function () { setMode(m); });
  });
  setMode(0);
})();
