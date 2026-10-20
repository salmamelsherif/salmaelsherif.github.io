(function () {
  "use strict";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Mobile menu ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.textContent = open ? "Close" : "Menu";
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") { nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); toggle.textContent = "Menu"; }
    });
  }

  /* ---------- Industry / Research switch ---------- */
  var sw = document.querySelector(".switch");
  if (sw) {
    var tabs = sw.querySelectorAll('[role="tab"]');
    var select = function (tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
      sw.classList.toggle("is-research", tab.id === "tab-research");
    };
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t); });
      t.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          var next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
          select(next); next.focus(); e.preventDefault();
        }
      });
    });
  }

  /* ---------- Project filters ---------- */
  var chips = document.querySelectorAll(".chip[data-filter]");
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var f = chip.getAttribute("data-filter");
      chips.forEach(function (c) { c.setAttribute("aria-pressed", c === chip ? "true" : "false"); });
      document.querySelectorAll(".project").forEach(function (p) {
        p.hidden = !(f === "all" || p.getAttribute("data-kind") === f);
      });
    });
  });

  /* ---------- Copy email ---------- */
  document.querySelectorAll(".copy[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var el = document.querySelector(btn.getAttribute("data-copy"));
      var text = el ? el.textContent.trim() : "";
      var done = function () { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy email"; }, 1800); };
      var fallback = function () {
        var r = document.createRange(); r.selectNodeContents(el);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        btn.textContent = "Selected, press Ctrl+C";
      };
      try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
    });
  });

  /* ---------- Counting figures + timeline fill ---------- */
  if (!reduceMotion && "IntersectionObserver" in window) {
    var figs = document.querySelectorAll(".fig[data-count]");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        var el = en.target, end = +el.getAttribute("data-count"), t0 = null;
        var step = function (t) {
          if (!t0) t0 = t;
          var k = Math.min(1, (t - t0) / 1100);
          el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3)));
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    figs.forEach(function (f) {
      var r = f.getBoundingClientRect();
      if (r.top > window.innerHeight) io.observe(f);
    });

    var tl = document.querySelector(".timeline");
    if (tl) {
      var fill = function () {
        var r = tl.getBoundingClientRect();
        var v = (window.innerHeight * 0.75 - r.top) / r.height;
        tl.style.setProperty("--fill", Math.max(0, Math.min(1, v)).toFixed(3));
      };
      if (tl.getBoundingClientRect().top > window.innerHeight * 0.75) {
        fill();
        window.addEventListener("scroll", fill, { passive: true });
        window.addEventListener("resize", fill);
      }
    }
  }

  /* ---------- Hero: a small drinking water network ---------- */
  var canvas = document.getElementById("network");
  var hero = document.querySelector(".hero");
  var probe = document.getElementById("probe");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, dpr = 1, nodes = [], pipes = [], particles = [], source = null, running = true, hover = null;
  var C0 = 1.8;        // mg/L dosed at the plant
  var KDECAY = 0.11;   // first-order bulk decay per hop (illustrative)

  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  function build() {
    var rect = hero.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var rand = rng(20251020);
    var gap = W < 640 ? 64 : 84;
    var cols = Math.ceil(W / gap) + 1, rows = Math.ceil(H / gap) + 1;
    nodes = []; pipes = [];
    var grid = [];
    for (var r = 0; r < rows; r++) {
      grid[r] = [];
      for (var c = 0; c < cols; c++) {
        if (rand() < 0.16) { grid[r][c] = null; continue; }
        var n = { x: c * gap + (rand() - 0.5) * gap * 0.55, y: r * gap + (rand() - 0.5) * gap * 0.55, adj: [], d: Infinity, id: nodes.length + 1, kind: "junction", phase: rand() * 6.28 };
        grid[r][c] = n; nodes.push(n);
      }
    }
    var link = function (a, b, diameter) {
      var p = { a: a, b: b, dia: diameter };
      pipes.push(p); a.adj.push(p); b.adj.push(p);
    };
    for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) {
      var n0 = grid[r][c]; if (!n0) continue;
      if (c + 1 < cols && grid[r][c + 1] && rand() < 0.82) link(n0, grid[r][c + 1], rand() < 0.2 ? 2.4 : 1.2);
      if (r + 1 < rows && grid[r + 1][c] && rand() < 0.72) link(n0, grid[r + 1][c], rand() < 0.2 ? 2.4 : 1.2);
    }
    // treatment plant sits right of centre
    var tx = W < 760 ? W * 0.8 : W * 0.72, ty = W < 760 ? H * 0.9 : H * 0.42, best = null, bd = Infinity;
    nodes.forEach(function (n) { var d = Math.hypot(n.x - tx, n.y - ty); if (n.adj.length > 1 && d < bd) { bd = d; best = n; } });
    source = best; source.kind = "plant"; source.d = 0;
    // hops from the plant (breadth-first) set flow direction and residual
    var q = [source];
    while (q.length) {
      var cur = q.shift();
      cur.adj.forEach(function (p) {
        var o = p.a === cur ? p.b : p.a;
        if (o.d === Infinity) { o.d = cur.d + 1; q.push(o); }
      });
    }
    var far = nodes.filter(function (n) { return n.d !== Infinity && n.d > 4; });
    if (far.length) { far.sort(function (a, b) { return b.adj.length - a.adj.length; }); far[0].kind = "tank"; }
    nodes.forEach(function (n) {
      n.c = n.d === Infinity ? 0 : C0 * Math.exp(-KDECAY * n.d * (1 + (n.id % 7) / 20));
      n.age = n.d === Infinity ? null : n.d * 0.9 + (n.id % 5) * 0.13;
    });
    particles = [];
    var count = Math.round(Math.min(160, nodes.length * 0.9));
    for (var i = 0; i < count; i++) particles.push(spawn(true));
  }

  function downstream(n) {
    return n.adj.filter(function (p) { var o = p.a === n ? p.b : p.a; return o.d === n.d + 1; });
  }
  function spawn(scatter) {
    var from = source;
    if (scatter) {
      var pool = nodes.filter(function (n) { return n.d !== Infinity && downstream(n).length; });
      from = pool[Math.floor(Math.random() * pool.length)] || source;
    }
    var outs = downstream(from);
    if (!outs.length) return { dead: true };
    var p = outs[Math.floor(Math.random() * outs.length)];
    return { from: from, to: p.a === from ? p.b : p.a, t: scatter ? Math.random() : 0, v: 0.006 + Math.random() * 0.008 };
  }

  function textShade(x) {
    // fade the network behind the text column on wide screens
    if (W < 760) return 0.35;
    var edge = Math.min(W * 0.5, 620);
    return x < edge ? 0.22 + 0.5 * (x / edge) : 1;
  }

  function colorFor(c, a) {
    // high residual = bright aqua, low residual = dim steel blue
    var k = Math.max(0, Math.min(1, c / C0));
    var r = Math.round(70 + (60 - 70) * k), g = Math.round(110 + (210 - 110) * k), b = Math.round(150 + (225 - 150) * k);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  var t = 0;
  function draw() {
    t += 0.016;
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";
    pipes.forEach(function (p) {
      var s = textShade((p.a.x + p.b.x) / 2);
      ctx.strokeStyle = "rgba(120,170,205," + (0.16 * s + (p.dia > 2 ? 0.08 : 0)) + ")";
      ctx.lineWidth = p.dia;
      ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.b.x, p.b.y); ctx.stroke();
    });
    particles.forEach(function (q, i) {
      if (q.dead) { particles[i] = spawn(false); return; }
      if (!reduceMotion && running) q.t += q.v;
      if (q.t >= 1) {
        var outs = downstream(q.to);
        if (!outs.length || Math.random() < 0.06) { particles[i] = spawn(false); return; }
        var p = outs[Math.floor(Math.random() * outs.length)];
        q.from = q.to; q.to = p.a === q.from ? p.b : p.a; q.t = 0;
      }
      var x = q.from.x + (q.to.x - q.from.x) * q.t, y = q.from.y + (q.to.y - q.from.y) * q.t;
      var c = q.from.c + (q.to.c - q.from.c) * q.t;
      ctx.fillStyle = colorFor(c, 0.9 * textShade(x));
      ctx.beginPath(); ctx.arc(x, y, 2.1, 0, 6.283); ctx.fill();
    });
    nodes.forEach(function (n) {
      var s = textShade(n.x), isHover = n === hover;
      if (n.kind === "plant") {
        var pulse = reduceMotion ? 0 : (Math.sin(t * 2) + 1) * 4;
        ctx.fillStyle = "rgba(233,162,59,0.18)"; ctx.beginPath(); ctx.arc(n.x, n.y, 16 + pulse, 0, 6.283); ctx.fill();
        ctx.fillStyle = "#E9A23B"; ctx.beginPath(); ctx.arc(n.x, n.y, 8, 0, 6.283); ctx.fill();
        return;
      }
      if (n.kind === "tank") {
        ctx.fillStyle = colorFor(n.c, 0.95);
        ctx.fillRect(n.x - 7, n.y - 7, 14, 14);
        return;
      }
      var rad = (n.adj.length > 2 ? 3.6 : 2.8) + (isHover ? 3 : 0);
      ctx.fillStyle = colorFor(n.c, (isHover ? 1 : 0.85) * s);
      ctx.beginPath(); ctx.arc(n.x, n.y, rad, 0, 6.283); ctx.fill();
      if (isHover) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke(); }
    });
  }

  function loop() {
    if (running) draw();
    if (!reduceMotion) requestAnimationFrame(loop);
  }

  function showProbe(n, x, y) {
    if (!n) { probe.hidden = true; return; }
    var html;
    if (n.kind === "plant") html = "<strong>Treatment plant</strong><br>Chlorine dosed: " + C0.toFixed(2) + " mg/L";
    else if (n.d === Infinity) html = "<strong>Junction J" + n.id + "</strong><br>Not connected to the plant";
    else html = "<strong>" + (n.kind === "tank" ? "Storage tank T1" : "Junction J" + n.id) + "</strong><br>Chlorine: " + n.c.toFixed(2) + " mg/L" + (n.c < 0.2 ? " (low)" : "") + "<br>Water age: " + n.age.toFixed(1) + " h";
    probe.innerHTML = html;
    probe.hidden = false;
    var px = Math.min(x + 14, W - probe.offsetWidth - 8), py = y - probe.offsetHeight - 12;
    if (py < 8) py = y + 16;
    probe.style.left = px + "px"; probe.style.top = py + "px";
  }

  function onPoint(e) {
    var r = hero.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null, bd = 22;
    nodes.forEach(function (n) { var d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = n; } });
    if (best !== hover) { hover = best; if (reduceMotion) draw(); }
    showProbe(best, best ? best.x : 0, best ? best.y : 0);
  }
  hero.addEventListener("pointermove", onPoint);
  hero.addEventListener("pointerdown", onPoint);
  hero.addEventListener("pointerleave", function () { hover = null; probe.hidden = true; if (reduceMotion) draw(); });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { running = en[0].isIntersecting; }, { threshold: 0 }).observe(hero);
  }
  document.addEventListener("visibilitychange", function () { running = !document.hidden; });

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { build(); draw(); }, 150);
  });

  build(); draw(); loop();
})();
