// Shared helpers for the simulation canvases: theme colours, a banded jet colour map and a canvas loop.
window.CAE = (function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var listeners = [];
  var cache = null;

  function read() {
    var cs = getComputedStyle(document.documentElement);
    function g(n) { return cs.getPropertyValue(n).trim(); }
    cache = {
      bg1: g("--vp-bg1"), bg2: g("--vp-bg2"), mesh: g("--mesh-line"), ink: g("--ink"), ink2: g("--ink-2"),
      rule: g("--rule"), support: g("--support"), load: g("--load"), accent: g("--accent"), panel: g("--panel"),
      mono: g("--font-mono"), body: g("--font-body")
    };
  }
  function colors() { if (!cache) read(); return cache; }
  function onTheme(fn) { listeners.push(fn); }
  function themeChanged() { cache = null; listeners.forEach(function (fn) { fn(); }); }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  // Classic CAE contour map: blue, cyan, green, yellow, red.
  function jet(t) {
    t = clamp(t, 0, 1);
    var r = clamp(1.5 - Math.abs(4 * t - 3), 0, 1);
    var g = clamp(1.5 - Math.abs(4 * t - 2), 0, 1);
    var b = clamp(1.5 - Math.abs(4 * t - 1), 0, 1);
    return "rgb(" + Math.round(r * 255) + "," + Math.round(g * 255) + "," + Math.round(b * 255) + ")";
  }
  // Snap to n contour bands, as solver post-processors do.
  function band(t, n) {
    n = n || 9;
    return Math.min(n - 1, Math.floor(clamp(t, 0, 1) * n)) / (n - 1);
  }

  // Runs draw(ctx, w, h, seconds) every frame while the canvas is on screen.
  function loop(canvas, draw) {
    var ctx = canvas.getContext("2d");
    var w = 0, h = 0, visible = true, raf = 0;
    function resize() {
      var r = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function frame(t) {
      raf = 0;
      if (w && h) draw(ctx, w, h, t / 1000);
      if (visible && !reduce) raf = requestAnimationFrame(frame);
    }
    function redraw() { if (!raf) raf = requestAnimationFrame(frame); }
    if ("ResizeObserver" in window) new ResizeObserver(function () { resize(); redraw(); }).observe(canvas);
    else window.addEventListener("resize", function () { resize(); redraw(); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) redraw();
      }).observe(canvas);
    }
    onTheme(redraw);
    resize();
    redraw();
    return { redraw: redraw };
  }

  return { reduce: reduce, colors: colors, onTheme: onTheme, themeChanged: themeChanged, jet: jet, band: band, clamp: clamp, loop: loop };
})();
