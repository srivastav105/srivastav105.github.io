// Theme toggle, scroll progress, reveal-on-scroll, counters, CAD crosshair, case-study toggles, copy buttons.
(function () {
  var root = document.documentElement;
  var reduce = window.CAE ? window.CAE.reduce : false;

  // Theme
  var toggle = document.getElementById("theme-toggle");
  try {
    var saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") root.setAttribute("data-theme", saved);
  } catch (e) {}
  function label() {
    if (toggle) toggle.setAttribute("aria-label", root.getAttribute("data-theme") === "dark" ? "Switch to light theme" : "Switch to dark theme");
  }
  label();
  if (window.CAE) window.CAE.themeChanged();
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      label();
      if (window.CAE) window.CAE.themeChanged();
    });
  }

  // Slower, eased scrolling: mouse-wheel steps are softened and glide, and menu links travel over about 1.4 s.
  var WHEEL_SPEED = 0.55;   // fraction of each wheel step actually scrolled
  var EASE = 0.075;         // lower = smoother and slower glide
  var scrollTarget = window.scrollY, gliding = false;
  function maxScroll() { return document.documentElement.scrollHeight - window.innerHeight; }
  function glide() {
    var y = window.scrollY, d = scrollTarget - y;
    if (Math.abs(d) < 0.5) { window.scrollTo(0, scrollTarget); gliding = false; return; }
    window.scrollTo(0, y + d * EASE);
    requestAnimationFrame(glide);
  }
  if (!reduce && window.matchMedia("(pointer: fine)").matches) {
    window.addEventListener("wheel", function (e) {
      if (e.ctrlKey || e.defaultPrevented) return;
      // Let scrollable inner areas (tables, code) and sliders handle their own wheel
      var el = e.target;
      while (el && el !== document.body) {
        if (el.tagName === "INPUT") return;
        if (el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) return;
        el = el.parentElement;
      }
      e.preventDefault();
      var delta = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      if (!gliding) scrollTarget = window.scrollY;
      scrollTarget = Math.max(0, Math.min(maxScroll(), scrollTarget + delta * WHEEL_SPEED));
      if (!gliding) { gliding = true; requestAnimationFrame(glide); }
    }, { passive: false });
    // Keyboard and scrollbar scrolling stay native; keep the target in sync with them
    window.addEventListener("scroll", function () { if (!gliding) scrollTarget = window.scrollY; }, { passive: true });
  }

  var jumpId = 0;
  function scrollToY(to, duration) {
    var from = window.scrollY, start = performance.now(), id = ++jumpId;
    gliding = false;
    if (reduce) { window.scrollTo(0, to); return; }
    (function step(now) {
      if (id !== jumpId) return;
      var p = Math.min(1, (now - start) / duration);
      var e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      window.scrollTo(0, from + (to - from) * e);
      scrollTarget = window.scrollY;
      if (p < 1) requestAnimationFrame(step);
    })(start);
  }
  document.querySelectorAll("a[href^='#']").forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      var target = id === "#top" ? document.body : document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var navH = document.querySelector(".nav").offsetHeight;
      var to = id === "#top" ? 0 : target.getBoundingClientRect().top + window.scrollY - navH;
      to = Math.max(0, Math.min(maxScroll(), to));
      var dist = Math.abs(to - window.scrollY);
      scrollToY(to, Math.min(2200, 900 + dist * 0.25));
      if (history.replaceState) history.replaceState(null, "", id);
    });
  });

  // Scroll progress and active nav link
  var bar = document.getElementById("progress");
  var links = Array.prototype.slice.call(document.querySelectorAll(".nav-links a[href^='#']"));
  var targets = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });
  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = "scaleX(" + (max > 0 ? window.scrollY / max : 0) + ")";
    var current = -1;
    targets.forEach(function (t, i) { if (t && t.getBoundingClientRect().top < window.innerHeight * 0.35) current = i; });
    links.forEach(function (a, i) { a.classList.toggle("active", i === current); });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Reveal and counters
  function formatCount(el, v) {
    var dec = Number(el.dataset.decimals || 0);
    return (el.dataset.prefix || "") + v.toLocaleString("en-IN", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (el.dataset.suffix || "");
  }
  function runCount(el) {
    var end = Number(el.dataset.count);
    if (reduce) { el.textContent = formatCount(el, end); return; }
    var start = performance.now(), dur = 1400;
    function step(now) {
      var p = Math.min(1, (now - start) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = formatCount(el, end * e);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var reveals = document.querySelectorAll(".reveal");
  var counters = document.querySelectorAll("[data-count]");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        if (en.target.dataset.count) runCount(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.15 });
    reveals.forEach(function (el) { io.observe(el); });
    counters.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  // CAD crosshair and coordinate readout in the hero
  var hero = document.querySelector(".hero");
  var xh = document.getElementById("xh");
  var coords = document.getElementById("coords");
  if (hero && xh && window.matchMedia("(pointer: fine)").matches) {
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      xh.style.setProperty("--x", x + "px");
      xh.style.setProperty("--y", y + "px");
      xh.classList.add("on");
      if (coords) coords.textContent = "X " + (x / 4).toFixed(1).padStart(6, " ") + "   Y " + ((r.height - y) / 4).toFixed(1).padStart(6, " ") + "   mm";
    });
    hero.addEventListener("pointerleave", function () { xh.classList.remove("on"); });
  }

  // Typed solver log in the hero
  var typed = document.getElementById("typed");
  var phrases = [
    "Static structural · von Mises stress",
    "Modal analysis · 3 bending modes",
    "Ball screw + servo sizing · load, inertia, life",
    "GD&T · ASME Y14.5 · tolerance stack-up",
    "Lightweighting · −70 kg headstock",
    "Buckling · MSC Nastran SOL 105"
  ];
  if (typed && !reduce) {
    var pi = 0, ci = phrases[0].length, deleting = true;
    setTimeout(function tick() {
      var p = phrases[pi];
      if (deleting) {
        ci--;
        if (ci <= 0) { deleting = false; pi = (pi + 1) % phrases.length; }
      } else {
        ci++;
        if (ci >= phrases[pi].length) { deleting = true; typed.textContent = "> " + phrases[pi]; setTimeout(tick, 2200); return; }
      }
      typed.textContent = "> " + phrases[pi].slice(0, Math.max(0, ci));
      setTimeout(tick, deleting ? 22 : 45);
    }, 2200);
    typed.textContent = "> " + phrases[0];
  }

  // Counterbalance before/after
  var cb = document.getElementById("cb-figure");
  document.querySelectorAll("[data-cb]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var after = btn.dataset.cb === "after";
      cb.classList.toggle("after", after);
      document.querySelectorAll("[data-cb]").forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
    });
  });

  // Motor exploded view
  var motor = document.getElementById("motor");
  var explode = document.getElementById("explode");
  if (motor && explode) {
    explode.addEventListener("click", function () {
      var on = motor.classList.toggle("exploded");
      explode.setAttribute("aria-pressed", String(on));
      explode.textContent = on ? "Assemble" : "Explode view";
    });
  }

  // Copy buttons
  var toast = document.getElementById("toast");
  var timer;
  function show(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(function () { toast.hidden = true; }, 1800);
  }
  document.querySelectorAll("button[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var value = btn.getAttribute("data-copy");
      var text = btn.parentElement.querySelector(".t");
      function fallback() {
        var r = document.createRange();
        r.selectNodeContents(text);
        var s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
        show("Selected. Press Ctrl+C to copy");
      }
      try {
        navigator.clipboard.writeText(value).then(function () { show("Copied " + value); }, fallback);
      } catch (e) { fallback(); }
    });
  });

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
