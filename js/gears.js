// Meshing spur-gear graphics drawn as SVG. Speeds and phases follow real tooth ratios.
// The drive-train demo lets visitors set motor speed or drag the driver gear by hand.
(function () {
  var SVG = "http://www.w3.org/2000/svg";
  var reduce = window.CAE ? window.CAE.reduce : false;

  function el(name, attrs, parent) {
    var node = document.createElementNS(SVG, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function circlePath(r) {
    return "M" + r + " 0A" + r + " " + r + " 0 1 0 " + -r + " 0A" + r + " " + r + " 0 1 0 " + r + " 0Z";
  }

  // Outline of a spur gear with N teeth and module m, centred on 0,0. Tooth 0 points along +x.
  function gearPath(N, m) {
    var r = (m * N) / 2, ro = r + m, ri = r - 1.25 * m;
    var p = Math.PI / N, wr = p * 0.62, wt = p * 0.34;
    var d = "";
    for (var i = 0; i < N; i++) {
      var c = (2 * Math.PI * i) / N;
      var pts = [[ri, c - wr], [ro, c - wt], [ro, c + wt], [ri, c + wr]];
      for (var j = 0; j < pts.length; j++) {
        var R = pts[j][0], a = pts[j][1];
        d += (i === 0 && j === 0 ? "M" : "L") + (R * Math.cos(a)).toFixed(2) + " " + (R * Math.sin(a)).toFixed(2);
      }
      var nc = (2 * Math.PI * (i + 1)) / N - wr;
      d += "A" + ri + " " + ri + " 0 0 1 " + (ri * Math.cos(nc)).toFixed(2) + " " + (ri * Math.sin(nc)).toFixed(2);
    }
    d += "Z";
    var bore = Math.max(m * 1.6, ri * 0.22);
    d += circlePath(bore);
    var holes = N >= 20 ? 5 : 0;
    if (holes) {
      var hr = (ri - bore) * 0.26, hc = bore + (ri - bore) * 0.5;
      for (var h = 0; h < holes; h++) {
        var ang = (2 * Math.PI * h) / holes + Math.PI / holes;
        var cx = hc * Math.cos(ang), cy = hc * Math.sin(ang);
        d += "M" + (cx + hr).toFixed(2) + " " + cy.toFixed(2) +
          "A" + hr + " " + hr + " 0 1 0 " + (cx - hr).toFixed(2) + " " + cy.toFixed(2) +
          "A" + hr + " " + hr + " 0 1 0 " + (cx + hr).toFixed(2) + " " + cy.toFixed(2) + "Z";
      }
    }
    return d;
  }

  // Each gear after the first names a parent and the angle (deg) from the parent's centre.
  function layoutTrain(spec, m) {
    var gears = [];
    spec.forEach(function (g, i) {
      var gear = { N: g.N, x: 0, y: 0, c: 0, ratio: 1, sign: 1, accent: !!g.accent };
      if (i > 0) {
        var P = gears[g.parent];
        var th = (g.angle * Math.PI) / 180;
        var dist = ((P.N + g.N) * m) / 2;
        gear.x = P.x + dist * Math.cos(th);
        gear.y = P.y + dist * Math.sin(th);
        // Phase so a tooth of the parent meets a gap of the child
        gear.c = th + Math.PI + ((th - P.c) * P.N - Math.PI) / g.N;
        gear.ratio = P.ratio * (P.N / g.N);
        gear.sign = -P.sign;
      }
      gears.push(gear);
    });
    return gears;
  }

  function build(svg, spec, m, pad, labels) {
    var gears = layoutTrain(spec, m);
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    gears.forEach(function (g) {
      var ro = (m * g.N) / 2 + m;
      minX = Math.min(minX, g.x - ro); minY = Math.min(minY, g.y - ro);
      maxX = Math.max(maxX, g.x + ro); maxY = Math.max(maxY, g.y + ro);
    });
    pad = pad == null ? 12 : pad;
    svg.setAttribute("viewBox", [minX - pad, minY - pad, maxX - minX + 2 * pad, maxY - minY + 2 * pad].map(function (v) { return v.toFixed(1); }).join(" "));
    gears.forEach(function (g, i) {
      var r = (m * g.N) / 2;
      var outer = el("g", { transform: "translate(" + g.x.toFixed(2) + " " + g.y.toFixed(2) + ")" }, svg);
      g.node = el("g", {}, outer);
      g.body = el("path", { d: gearPath(g.N, m), class: "gear-body" + (g.accent ? " gear-accent" : ""), "fill-rule": "evenodd" }, g.node);
      el("circle", { r: r, class: "gear-pitch" }, outer);
      var cl = r * 0.35;
      el("path", { d: "M" + -cl + " 0H" + cl + "M0 " + -cl + "V" + cl, class: "gear-centre" }, outer);
      if (labels) {
        var t = el("text", { x: 0, y: r * 0.62 + 4, class: "gear-label", "text-anchor": "middle" }, outer);
        t.textContent = "G" + (i + 1);
      }
    });
    return gears;
  }

  function setRotation(gears, theta) {
    gears.forEach(function (g) {
      var a = g.c + g.sign * g.ratio * theta;
      g.node.setAttribute("transform", "rotate(" + ((a * 180) / Math.PI).toFixed(3) + ")");
    });
  }

  var trains = [];

  // Drive-train demo
  var drive = document.getElementById("drive-gears");
  var driveGears = null, theta = 0, rpm = 1200, dragging = false, lastAngle = 0;
  if (drive) {
    driveGears = build(drive, [
      { N: 28, accent: true },
      { N: 16, parent: 0, angle: -32 },
      { N: 22, parent: 0, angle: 118 },
      { N: 12, parent: 1, angle: -95 },
      { N: 18, parent: 2, angle: 40 }
    ], 6, 12, true);
    driveGears[0].body.classList.add("gear-driver");

    var tbody = document.getElementById("drive-table");
    var rpmInput = document.getElementById("rpm");
    var rpmOut = document.getElementById("rpm-out");
    var rows = driveGears.map(function (g, i) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>G" + (i + 1) + (i === 0 ? " <span class=\"pill\">driver</span>" : "") + "</td><td>" + g.N +
        "</td><td class=\"num\"></td><td>" + (g.sign > 0 ? "CW" : "CCW") + "</td>";
      tbody.appendChild(tr);
      function on() { tr.classList.add("hl"); g.body.classList.add("hl"); }
      function off() { tr.classList.remove("hl"); g.body.classList.remove("hl"); }
      tr.addEventListener("mouseenter", on); tr.addEventListener("mouseleave", off);
      g.body.addEventListener("mouseenter", on); g.body.addEventListener("mouseleave", off);
      return tr;
    });
    function updateTable() {
      rows.forEach(function (tr, i) {
        tr.children[2].textContent = Math.round(rpm * driveGears[i].ratio).toLocaleString("en-IN");
      });
      if (rpmOut) rpmOut.textContent = rpm.toLocaleString("en-IN") + " rpm";
    }
    if (rpmInput) {
      rpm = Number(rpmInput.value);
      rpmInput.addEventListener("input", function () { rpm = Number(rpmInput.value); updateTable(); });
    }
    updateTable();

    function svgAngle(e) {
      var pt = drive.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      var p = pt.matrixTransform(drive.getScreenCTM().inverse());
      return Math.atan2(p.y - driveGears[0].y, p.x - driveGears[0].x);
    }
    driveGears[0].body.addEventListener("pointerdown", function (e) {
      dragging = true;
      lastAngle = svgAngle(e);
      drive.setPointerCapture(e.pointerId);
      drive.classList.add("dragging");
      e.preventDefault();
    });
    drive.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var a = svgAngle(e), d = a - lastAngle;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      theta += d;
      lastAngle = a;
      setRotation(driveGears, theta);
    });
    function end() { dragging = false; drive.classList.remove("dragging"); }
    drive.addEventListener("pointerup", end);
    drive.addEventListener("pointercancel", end);
    setRotation(driveGears, 0);
  }

  var logo = document.getElementById("logo-gear");
  if (logo) trains.push({ gears: build(logo, [{ N: 10 }], 3, 2), speed: 0.35 });
  document.querySelectorAll("[data-gear-pair]").forEach(function (svg) {
    trains.push({ gears: build(svg, [{ N: 14 }, { N: 9, parent: 0, angle: 0 }], 2.4, 2), speed: 0.3 });
  });

  var last = performance.now(), t0 = last;
  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    var scroll = window.scrollY / 600;
    trains.forEach(function (tr) { setRotation(tr.gears, reduce ? 0 : ((now - t0) / 1000) * tr.speed + scroll); });
    if (driveGears && !dragging && !reduce) {
      theta += ((rpm * 2 * Math.PI) / 60) * dt * 0.05;
      setRotation(driveGears, theta);
    }
    if (!reduce) requestAnimationFrame(frame);
  }
  frame(t0);
})();
