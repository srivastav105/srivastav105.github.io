// Lightweighting demo: remove the lowest-stress material first and keep the load paths.
// An illustration of the method, not the real headstock casting.
(function () {
  var canvas = document.getElementById("lw");
  if (!canvas) return;
  var C = window.CAE;
  var slider = document.getElementById("lw-slider");
  var massOut = document.getElementById("lw-mass");
  var costOut = document.getElementById("lw-cost");
  var play = document.getElementById("lw-play");

  var COLS = 22, ROWS = 14;
  var cells = [];
  function segDist(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var t = C.clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    var cx = ax + t * dx, cy = ay + t * dy;
    return Math.hypot(px - cx, py - cy);
  }
  // Load at the spindle bore (top centre), reacted at the two bottom mounting faces.
  var paths = [[0.5, 0.12, 0.08, 0.95], [0.5, 0.12, 0.92, 0.95], [0.5, 0.12, 0.5, 0.95], [0.08, 0.95, 0.92, 0.95]];
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var x = (c + 0.5) / COLS, y = (r + 0.5) / ROWS;
      var s = 0.08;
      paths.forEach(function (p, idx) {
        var d = segDist(x, y, p[0], p[1], p[2], p[3]);
        var wgt = idx === 3 ? 0.55 : 1;
        s = Math.max(s, wgt * Math.exp(-(d * d) / 0.006));
      });
      var bore = Math.hypot((x - 0.5) * 1.5, y - 0.12);
      s = Math.max(s, Math.exp(-(bore * bore) / 0.01));
      var rim = c === 0 || c === COLS - 1 || r === 0 || r === ROWS - 1;
      cells.push({ x: c, y: r, s: s, keep: rim || s > 0.42, alpha: 1, target: 1 });
    }
  }
  var removable = cells.filter(function (cl) { return !cl.keep; }).sort(function (p, q) { return p.s - q.s; });

  var amount = slider ? Number(slider.value) : 100;
  function apply() {
    var n = Math.round((removable.length * amount) / 100);
    removable.forEach(function (cl, i) { cl.target = i < n ? 0 : 1; if (C.reduce) cl.alpha = cl.target; });
    if (massOut) massOut.textContent = Math.round((70 * amount) / 100) + " kg";
    if (costOut) costOut.textContent = "₹" + Math.round((6000 * amount) / 100).toLocaleString("en-IN");
  }

  function draw(ctx, w, h, t) {
    var col = C.colors();
    var bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, col.bg1);
    bg.addColorStop(1, col.bg2);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    var pad = 26, top = 46;
    var cw = Math.min((w - pad * 2) / COLS, (h - top - 34) / ROWS);
    var ox = (w - cw * COLS) / 2, oy = top;

    ctx.lineWidth = 0.5;
    ctx.strokeStyle = col.mesh;
    cells.forEach(function (cl) {
      cl.alpha += (cl.target - cl.alpha) * 0.18;
      if (cl.alpha < 0.02) return;
      ctx.globalAlpha = cl.alpha;
      ctx.fillStyle = C.jet(C.band(cl.s, 9));
      var inset = (1 - cl.alpha) * cw * 0.35;
      ctx.fillRect(ox + cl.x * cw + inset, oy + cl.y * cw + inset, cw - inset * 2, cw - inset * 2);
      ctx.strokeRect(ox + cl.x * cw + inset, oy + cl.y * cw + inset, cw - inset * 2, cw - inset * 2);
    });
    ctx.globalAlpha = 1;

    // outline of the original envelope
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = col.ink2;
    ctx.strokeRect(ox, oy, cw * COLS, cw * ROWS);
    ctx.restore();

    // spindle load
    var lx = ox + cw * COLS * 0.5, ly = oy;
    ctx.strokeStyle = col.load;
    ctx.fillStyle = col.load;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(lx, ly - 34); ctx.lineTo(lx, ly - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lx, ly - 1); ctx.lineTo(lx - 6, ly - 11); ctx.lineTo(lx + 6, ly - 11); ctx.closePath(); ctx.fill();
    ctx.font = "500 11px " + col.mono;
    ctx.fillText("Cutting load", lx + 10, ly - 20);

    // mounting faces
    ctx.fillStyle = col.support;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(ox, oy + cw * ROWS + 4, cw * 4, 5);
    ctx.fillRect(ox + cw * (COLS - 4), oy + cw * ROWS + 4, cw * 4, 5);
    ctx.globalAlpha = 1;
    ctx.fillStyle = col.ink2;
    ctx.fillText("Mounting faces", ox, oy + cw * ROWS + 24);

    ctx.fillStyle = col.ink;
    ctx.font = "600 11px " + col.body;
    ctx.fillText("Equivalent Stress · load paths", 14, 20);
  }

  var view = C.loop(canvas, draw);
  apply();

  if (slider) {
    slider.addEventListener("input", function () {
      amount = Number(slider.value);
      stopPlay();
      apply();
      view.redraw();
    });
  }

  var playTimer = 0;
  function stopPlay() {
    if (playTimer) { clearInterval(playTimer); playTimer = 0; }
    if (play) play.textContent = "Run optimisation";
  }
  if (play) {
    play.addEventListener("click", function () {
      if (playTimer) { stopPlay(); return; }
      amount = 0;
      apply();
      play.textContent = "Stop";
      playTimer = setInterval(function () {
        amount = Math.min(100, amount + 2);
        if (slider) slider.value = amount;
        apply();
        view.redraw();
        if (amount >= 100) stopPlay();
      }, C.reduce ? 10 : 60);
    });
  }
})();
