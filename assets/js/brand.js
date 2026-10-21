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
  // Junctions are nodes; pumps and valves sit on pipes, as in EPANET.
  // Chlorine and water age are computed from distance to the plant; equipment states are illustrative.
  var canvas = document.getElementById("network");
  var hero = document.querySelector(".hero");
  var probe = document.getElementById("probe");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, dpr = 1, nodes = [], pipes = [], particles = [], source = null, running = true, hover = null;
  var links = [];      // pumps and valves placed on pipes
  var C0 = 1.8;        // mg/L dosed at the plant
  var KDECAY = 0.09;   // first-order decay per hop (illustrative)

  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function other(p, n) { return p.a === n ? p.b : p.a; }

  function build() {
    var rect = hero.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var rand = rng(20251020);
    var narrow = W < 760;
    var gap = narrow ? 66 : 84;
    var cols = Math.ceil(W / gap) + 1, rows = Math.ceil(H / gap) + 1;
    nodes = []; pipes = []; links = [];
    var grid = [];
    for (var r = 0; r < rows; r++) {
      grid[r] = [];
      for (var c = 0; c < cols; c++) {
        if (rand() < 0.1) { grid[r][c] = null; continue; }
        var n = { x: c * gap + (rand() - 0.5) * gap * 0.5, y: r * gap + (rand() - 0.5) * gap * 0.5, r: r, c: c, adj: [], d: Infinity, id: nodes.length + 1, kind: "junction" };
        grid[r][c] = n; nodes.push(n);
      }
    }
    var has = function (a, b) { return a.adj.some(function (p) { return other(p, a) === b; }); };
    var link = function (a, b, main) {
      var p = { a: a, b: b, dia: main ? 2.6 : 1.3 };
      pipes.push(p); a.adj.push(p); b.adj.push(p); return p;
    };
    var neighbours = function (n) {
      var out = [];
      [[0, 1], [1, 0], [0, -1], [-1, 0]].forEach(function (d) {
        var rr = n.r + d[0], cc = n.c + d[1];
        if (rr >= 0 && rr < rows && cc >= 0 && cc < cols && grid[rr][cc]) out.push(grid[rr][cc]);
      });
      return out;
    };

    // treatment plant: right of centre on desktop, low on phones (clear of the text)
    var tx = narrow ? W * 0.91 : W * 0.72, ty = narrow ? H * 0.675 : H * 0.42, best = null, bd = Infinity;
    nodes.forEach(function (n) { var d = Math.hypot(n.x - tx, n.y - ty); if (d < bd) { bd = d; best = n; } });
    source = best; source.kind = "plant";

    // 1) a random spanning tree from the plant, so every junction is reachable
    var inTree = new Set([source]), frontier = [];
    var pushEdges = function (n) { neighbours(n).forEach(function (m) { if (!inTree.has(m)) frontier.push([n, m]); }); };
    pushEdges(source);
    while (frontier.length) {
      var k = Math.floor(rand() * frontier.length), e = frontier.splice(k, 1)[0];
      if (inTree.has(e[1])) continue;
      link(e[0], e[1], false); inTree.add(e[1]); pushEdges(e[1]);
    }
    // islands cut off by missing grid cells join their nearest connected junction
    nodes.forEach(function (n) {
      if (inTree.has(n)) return;
      var near = null, nd = Infinity;
      inTree.forEach(function (m) { var d = Math.hypot(n.x - m.x, n.y - m.y); if (d < nd) { nd = d; near = m; } });
      link(n, near, false); inTree.add(n);
    });
    // 2) extra pipes close loops, like a real gridded distribution system
    nodes.forEach(function (n) {
      neighbours(n).forEach(function (m) { if (m.id > n.id && !has(n, m) && rand() < 0.4) link(n, m, false); });
    });

    // 3) a few junctions left disconnected on purpose
    var isolatedWanted = narrow ? 1 : 3, picked = [];
    var leaves = nodes.filter(function (n) { return n.kind === "junction" && n.adj.length === 1 && (narrow ? n.x > W * 0.72 && n.y > H * 0.3 && n.y < H * 0.62 : n.x > W * 0.5) && n.y > 30 && n.y < H - 30; });
    leaves.sort(function () { return rand() - 0.5; });
    leaves.forEach(function (n) {
      if (picked.length >= isolatedWanted) return;
      if (picked.some(function (m) { return Math.hypot(n.x - m.x, n.y - m.y) < gap * 3; })) return;
      if (Math.hypot(n.x - source.x, n.y - source.y) < gap * 2) return;
      var p = n.adj[0], m = other(p, n);
      m.adj.splice(m.adj.indexOf(p), 1); n.adj = [];
      pipes.splice(pipes.indexOf(p), 1);
      n.kind = "isolated"; picked.push(n);
    });

    // hops from the plant set flow direction, residual and age
    source.d = 0;
    var q = [source];
    while (q.length) {
      var cur = q.shift();
      cur.adj.forEach(function (p) { var o = other(p, cur); if (o.d === Infinity) { o.d = cur.d + 1; q.push(o); } });
    }
    nodes.forEach(function (n) {
      n.c = n.d === Infinity ? 0 : C0 * Math.exp(-KDECAY * n.d * (1 + (n.id % 7) / 20));
      n.age = n.d === Infinity ? null : n.d * 0.9 + (n.id % 5) * 0.13;
    });
    pipes.forEach(function (p) { if (p.b.d < p.a.d) { var tmp = p.a; p.a = p.b; p.b = tmp; } });

    // trunk mains: follow the pipes from the plant outward a few hops
    var markMain = function (n, steps) {
      if (!steps) return;
      n.adj.filter(function (p) { return p.a === n; }).slice(0, 2).forEach(function (p) { p.dia = 2.6; markMain(p.b, steps - 1); });
    };
    markMain(source, narrow ? 3 : 4);

    var clear = function (x, y) { return narrow ? (x > W * 0.72 && y > H * 0.3 && y < H * 0.62) : x > W * 0.55; };
    var usable = function (n) { return n.kind === "junction" && clear(n.x, n.y) && n.x > 24 && n.x < W - 24 && n.y > 24 && n.y < H - 24; };
    var spaced = function (pt, list, min) { return list.every(function (o) { return Math.hypot(pt.x - o.x, pt.y - o.y) > min; }); };

    // storage tanks: far from the plant, on quieter ends of the network
    var tanks = [], cands = nodes.filter(function (n) { return usable(n) && n.d > 3; });
    cands.sort(function (a, b) { return (b.d - a.d) + (a.adj.length - b.adj.length) * 0.5; });
    cands.forEach(function (n) {
      if (tanks.length < 2 && spaced(n, tanks.concat([source]), gap * 3)) { n.kind = "tank"; n.tag = "T" + (tanks.length + 1); tanks.push(n); }
    });

    // pumps (on pipes): the high-service pump at the plant, plus a booster on the way to a tank
    var placed = [];
    var addLink = function (p, type, tag, detail) {
      var x = (p.a.x + p.b.x) / 2, y = (p.a.y + p.b.y) / 2;
      var item = { type: type, pipe: p, x: x, y: y, tag: tag, detail: detail };
      p.feature = item; links.push(item); placed.push(item); return item;
    };
    var outOfPlant = source.adj.filter(function (p) { return p.a === source; });
    if (outOfPlant.length) addLink(outOfPlant[0], "pump", "PU1", "High-service pump, running");
    if (tanks.length) {
      var near = tanks[0].adj.length ? tanks[0].adj.filter(function (p) { return p.b === tanks[0]; })[0] : null;
      if (near && near.a.adj.length) {
        var up = near.a.adj.filter(function (p) { return p.b === near.a; })[0];
        if (up && !up.feature) addLink(up, "pump", "PU2", "Booster pump, running");
      }
    }

    // valves (on pipes)
    var valveTypes = ["Pressure-reducing valve, active", "Isolation valve, open", "Flow control valve, active", "Isolation valve, open", "Pressure-sustaining valve, active"];
    var vp = pipes.filter(function (p) {
      var mx = (p.a.x + p.b.x) / 2, my = (p.a.y + p.b.y) / 2;
      return !p.feature && clear(mx, my) && mx > 20 && mx < W - 20 && my > 20 && my < H - 20 && Math.hypot(p.a.x - p.b.x, p.a.y - p.b.y) > gap * 0.7;
    });
    vp.sort(function () { return rand() - 0.5; });
    var v = 0, wanted = narrow ? 3 : 5;
    vp.forEach(function (p) {
      if (v >= wanted) return;
      var mid = { x: (p.a.x + p.b.x) / 2, y: (p.a.y + p.b.y) / 2 };
      if (!spaced(mid, placed.concat(tanks, [source]), gap * 1.6)) return;
      addLink(p, "valve", "V" + (v + 1), valveTypes[v]); v++;
    });

    particles = [];
    var count = Math.round(Math.min(170, nodes.length * 0.9));
    for (var i = 0; i < count; i++) particles.push(spawn(true));
  }

  function downstream(n) { return n.adj.filter(function (p) { return p.a === n; }); }
  function spawn(scatter) {
    var from = source;
    if (scatter) {
      var pool = nodes.filter(function (n) { return n.d !== Infinity && downstream(n).length; });
      from = pool[Math.floor(Math.random() * pool.length)] || source;
    }
    var outs = downstream(from);
    if (!outs.length) return { dead: true };
    var p = outs[Math.floor(Math.random() * outs.length)];
    return { from: from, to: p.b, t: scatter ? Math.random() : 0, v: 0.006 + Math.random() * 0.008 };
  }

  function textShade(x) {
    // fade the network behind the text column
    if (W < 760) return 0.35;
    var edge = Math.min(W * 0.52, 700);
    return x < edge ? 0.22 + 0.5 * (x / edge) : 1;
  }

  function colorFor(c, a) {
    // high residual = bright aqua, low residual = dim steel blue
    var k = Math.max(0, Math.min(1, c / C0));
    var r = Math.round(70 + (60 - 70) * k), g = Math.round(110 + (210 - 110) * k), b = Math.round(150 + (225 - 150) * k);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  var EQUIP = "#DCEAF3";   // light symbol colour on the deep hero
  var NAVY = "#032141";

  function drawPump(f, on) {
    var a = Math.atan2(f.pipe.b.y - f.pipe.a.y, f.pipe.b.x - f.pipe.a.x);
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(a);
    ctx.fillStyle = NAVY; ctx.strokeStyle = EQUIP; ctx.lineWidth = on ? 2.2 : 1.6;
    ctx.beginPath(); ctx.arc(0, 0, on ? 10 : 8.5, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.fillStyle = EQUIP;
    ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3.5, -4.5); ctx.lineTo(-3.5, 4.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function drawValve(f, on) {
    var a = Math.atan2(f.pipe.b.y - f.pipe.a.y, f.pipe.b.x - f.pipe.a.x), s = on ? 10 : 8;
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(a);
    ctx.fillStyle = EQUIP; ctx.strokeStyle = NAVY; ctx.lineWidth = 1.5; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(-s, -s * 0.75); ctx.lineTo(s, s * 0.75); ctx.lineTo(s, -s * 0.75); ctx.lineTo(-s, s * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function drawTank(n, on) {
    var w = on ? 22 : 18, h = on ? 18 : 15;
    ctx.fillStyle = NAVY; ctx.strokeStyle = EQUIP; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.rect(n.x - w / 2, n.y - h / 2, w, h); ctx.fill(); ctx.stroke();
    // water level, about two thirds full
    ctx.fillStyle = colorFor(n.c, 0.95);
    ctx.fillRect(n.x - w / 2 + 2.5, n.y - h / 2 + h * 0.36, w - 5, h * 0.64 - 2.5);
  }

  var t = 0;
  function draw() {
    t += 0.016;
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";
    pipes.forEach(function (p) {
      var s = textShade((p.a.x + p.b.x) / 2);
      ctx.strokeStyle = "rgba(120,170,205," + ((p.dia > 2 ? 0.3 : 0.18) * s) + ")";
      ctx.lineWidth = p.dia;
      ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.b.x, p.b.y); ctx.stroke();
    });
    particles.forEach(function (q, i) {
      if (q.dead) { particles[i] = spawn(false); return; }
      if (!reduceMotion && running) q.t += q.v;
      if (q.t >= 1) {
        var outs = downstream(q.to);
        if (!outs.length || Math.random() < 0.05) { particles[i] = spawn(false); return; }
        var p = outs[Math.floor(Math.random() * outs.length)];
        q.from = q.to; q.to = p.b; q.t = 0;
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
        ctx.fillStyle = "rgba(233,162,59,0.18)"; ctx.beginPath(); ctx.arc(n.x, n.y, 17 + pulse, 0, 6.283); ctx.fill();
        ctx.fillStyle = "#E9A23B"; ctx.beginPath(); ctx.arc(n.x, n.y, 8.5, 0, 6.283); ctx.fill();
        return;
      }
      if (n.kind === "tank") { ctx.globalAlpha = W < 760 && !isHover ? 0.45 : 1; drawTank(n, isHover); ctx.globalAlpha = 1; return; }
      if (n.kind === "isolated") {
        ctx.strokeStyle = "rgba(159,184,202," + (isHover ? 1 : 0.7) * Math.max(s, 0.5) + ")";
        ctx.lineWidth = 1.5; ctx.setLineDash([2.5, 2.5]);
        ctx.beginPath(); ctx.arc(n.x, n.y, isHover ? 7 : 5, 0, 6.283); ctx.stroke();
        ctx.setLineDash([]);
        return;
      }
      var rad = (n.adj.length > 2 ? 3.6 : 2.8) + (isHover ? 3 : 0);
      ctx.fillStyle = colorFor(n.c, (isHover ? 1 : 0.85) * s);
      ctx.beginPath(); ctx.arc(n.x, n.y, rad, 0, 6.283); ctx.fill();
      if (isHover) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke(); }
    });
    links.forEach(function (f) {
      ctx.globalAlpha = W < 760 ? 0.4 : Math.max(textShade(f.x), 0.8);
      if (f.type === "pump") drawPump(f, f === hover); else drawValve(f, f === hover);
      ctx.globalAlpha = 1;
    });
  }

  function loop() {
    if (running) draw();
    if (!reduceMotion) requestAnimationFrame(loop);
  }

  function showProbe(n) {
    if (!n) { probe.hidden = true; return; }
    var html;
    if (n.type === "pump" || n.type === "valve") html = "<strong>" + (n.type === "pump" ? "Pump " : "Valve ") + n.tag + "</strong><br>" + n.detail;
    else if (n.kind === "plant") html = "<strong>Treatment plant</strong><br>Chlorine dosed: " + C0.toFixed(2) + " mg/L";
    else if (n.kind === "isolated") html = "<strong>Junction J" + n.id + "</strong><br>Not connected to the network";
    else html = "<strong>" + (n.kind === "tank" ? "Storage tank " + n.tag : "Junction J" + n.id) + "</strong><br>Chlorine: " + n.c.toFixed(2) + " mg/L" + (n.c < 0.2 ? " (low)" : "") + "<br>Water age: " + n.age.toFixed(1) + " h";
    probe.innerHTML = html;
    probe.hidden = false;
    var px = Math.max(8, Math.min(n.x + 14, W - probe.offsetWidth - 8)), py = n.y - probe.offsetHeight - 12;
    if (py < 8) py = n.y + 16;
    probe.style.left = px + "px"; probe.style.top = py + "px";
  }

  function onPoint(e) {
    var r = hero.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null, bd = 22;
    nodes.concat(links).forEach(function (n) { var d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = n; } });
    if (best !== hover) { hover = best; if (reduceMotion) draw(); }
    showProbe(best);
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
