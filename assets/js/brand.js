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

  /* ---------- Two-way switches (Industry / Research, Papers / Talks) ---------- */
  document.querySelectorAll(".switch").forEach(function (sw) {
    var tabs = Array.prototype.slice.call(sw.querySelectorAll('[role="tab"]'));
    var select = function (tab, updateHash) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
      sw.classList.toggle("is-second", tabs.indexOf(tab) === 1);
      if (updateHash && sw.classList.contains("research-switch")) {
        try { history.replaceState(null, "", tabs.indexOf(tab) === 1 ? "#talks" : "#papers"); } catch (e) {}
      }
    };
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t, true); });
      t.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          var next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
          select(next, true); next.focus(); e.preventDefault();
        }
      });
    });
    // open the Talks tab directly from a #talks link
    if (sw.classList.contains("research-switch") && location.hash === "#talks" && tabs[1]) select(tabs[1], false);
  });

  /* ---------- Project filters ---------- */
  var chips = document.querySelectorAll(".chip[data-filter]");
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var f = chip.getAttribute("data-filter");
      chips.forEach(function (c) { c.setAttribute("aria-pressed", c === chip ? "true" : "false"); });
      var scope = chip.closest('[role="tabpanel"]') || document;
      scope.querySelectorAll(".project, .pub-item").forEach(function (p) {
        p.hidden = !(f === "all" || p.getAttribute("data-kind") === f);
      });
      // hide year groups that have nothing left to show
      scope.querySelectorAll(".pub-year").forEach(function (g) {
        g.hidden = !g.querySelector(".pub-item:not([hidden])");
      });
    });
  });

  /* ---------- Research filters (type and year dropdowns) ---------- */
  var rList = document.querySelector(".research-list");
  if (rList) {
    var rItems = Array.prototype.slice.call(rList.querySelectorAll(".pub-item"));
    var typeSel = document.querySelector("[data-filter-type]");
    var yearSel = document.querySelector("[data-filter-year]");
    var resetBtn = document.getElementById("rf-reset");
    var emptyEl = document.getElementById("rf-empty");
    // fill the year menu from the items themselves
    var years = [];
    rItems.forEach(function (it) { var y = it.getAttribute("data-year"); if (years.indexOf(y) < 0) years.push(y); });
    years.sort().reverse().forEach(function (y) {
      var o = document.createElement("option"); o.value = y; o.textContent = y; yearSel.appendChild(o);
    });
    var apply = function () {
      var t = typeSel.value, y = yearSel.value, shown = 0;
      rItems.forEach(function (it) {
        var ok = (t === "all" || it.getAttribute("data-kind") === t) && (y === "all" || it.getAttribute("data-year") === y);
        it.hidden = !ok; if (ok) shown++;
      });
      resetBtn.hidden = t === "all" && y === "all";
      emptyEl.hidden = shown > 0;
    };
    var reset = function () { typeSel.value = "all"; yearSel.value = "all"; apply(); };
    typeSel.addEventListener("change", apply);
    yearSel.addEventListener("change", apply);
    resetBtn.addEventListener("click", reset);
    document.querySelectorAll("[data-reset-filters]").forEach(function (b) { b.addEventListener("click", reset); });
    if (location.hash === "#talks") typeSel.value = "talk";
    apply();
  }

  /* ---------- Contact form ---------- */
  var dialog = document.getElementById("contact-dialog");
  var form = document.getElementById("contact-form");
  if (dialog && form && typeof dialog.showModal === "function") {
    var status = document.getElementById("cf-status");
    var send = document.getElementById("cf-send");
    var setStatus = function (msg, kind) { status.textContent = msg; status.className = "cd-status" + (kind ? " is-" + kind : ""); };
    document.querySelectorAll("[data-open-contact]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        setStatus("", "");
        dialog.showModal();
        var first = document.getElementById("cf-name"); if (first) first.focus();
      });
    });
    document.querySelectorAll("[data-close-contact]").forEach(function (el) {
      el.addEventListener("click", function () { dialog.close(); });
    });
    // click on the dimmed backdrop closes the form
    dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        var bad = form.querySelector(":invalid");
        setStatus(bad && bad.type === "email" && bad.value ? "Please enter a valid email address." : "Please fill in all four fields.", "error");
        if (bad) bad.focus();
        return;
      }
      if (form.botcheck && form.botcheck.checked) return;
      var key = form.access_key ? form.access_key.value : "";
      if (!key) { setStatus("The contact form isn't connected yet. Please reach out on LinkedIn for now.", "error"); return; }
      var data = {};
      new FormData(form).forEach(function (v, k) { if (k !== "botcheck") data[k] = v; });
      send.disabled = true; send.textContent = "Sending…"; setStatus("", "");
      fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(data)
      }).then(function (r) { return r.json(); }).then(function (res) {
        if (res && res.success) {
          form.reset();
          setStatus("Message sent. Thank you, I'll get back to you soon.", "ok");
        } else {
          setStatus("Your message didn't go through. Please try again in a moment.", "error");
        }
      }).catch(function () {
        setStatus("Your message didn't go through. Check your connection and try again.", "error");
      }).then(function () { send.disabled = false; send.textContent = "Send message"; });
    });
  }

  /* ---------- Timelines: a finished track stops at its last marker ---------- */
  var setTails = function () {
    document.querySelectorAll(".timeline").forEach(function (tl) {
      var last = tl.lastElementChild;
      if (!last) return;
      // ongoing track (current role) runs past the last marker; finished ones end on it
      tl.style.setProperty("--tail", last.classList.contains("is-current") ? "8px" : (last.offsetHeight - 14) + "px");
    });
  };
  setTails();
  window.addEventListener("resize", setTails);
  document.querySelectorAll(".timeline details").forEach(function (d) { d.addEventListener("toggle", setTails); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setTails);

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

    document.querySelectorAll(".timeline").forEach(function (tl) {
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
    });
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
  // Illustrative water quality, kept in realistic ranges:
  // age = travel time along pipes (+ stagnation at dead ends, + residence in tanks)
  // chlorine = first-order decay on that age, C = C0 * exp(-K * age)
  var C0 = 2.5;        // mg/L free chlorine leaving the plant
  var K = 0.8;         // 1/day, combined bulk + wall decay (typical range ~0.1 to 1+)
  var C_LOW = 0.2;     // mg/L, common minimum residual

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
    var tx = W * 0.72, ty = H * 0.42, best = null, bd = Infinity;
    var act = document.querySelector(".hero .actions");
    if (narrow && act) {   // on phones, sit just right of the buttons
      var ar = act.getBoundingClientRect();
      tx = W * 0.9; ty = ar.top - rect.top + ar.height / 2;
    }
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
    // the plant feeds every neighbouring junction, so water leaves on several mains
    neighbours(source).forEach(function (m) { if (!has(source, m)) link(source, m, true); });
    // 2) extra pipes close loops, like a real gridded distribution system
    nodes.forEach(function (n) {
      neighbours(n).forEach(function (m) { if (m.id > n.id && !has(n, m) && rand() < 0.4) link(n, m, false); });
    });

    // 3) a few junctions left disconnected on purpose
    var isolatedWanted = narrow ? 1 : 3, picked = [];
    var leaves = nodes.filter(function (n) { return n.kind === "junction" && n.adj.length === 1 && (narrow ? n.x > W * 0.7 && n.y > H * 0.3 : n.x > W * 0.5) && n.y > 30 && n.y < H - 30; });
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

    // hops from the plant: used to lay out mains and pick tank sites
    source.d = 0;
    var q = [source];
    while (q.length) {
      var cur = q.shift();
      cur.adj.forEach(function (p) { var o = other(p, cur); if (o.d === Infinity) { o.d = cur.d + 1; q.push(o); } });
    }
    pipes.forEach(function (p) { if (p.b.d < p.a.d) { var tmp = p.a; p.a = p.b; p.b = tmp; } });

    // trunk mains: follow the pipes from the plant outward a few hops
    var markMain = function (n, steps) {
      if (!steps) return;
      n.adj.filter(function (p) { return p.a === n; }).slice(0, 2).forEach(function (p) { p.dia = 2.6; markMain(p.b, steps - 1); });
    };
    markMain(source, narrow ? 3 : 4);
    source.adj.forEach(function (p) { p.dia = 2.6; });

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

    // travel time per pipe (hours): fast trunk mains, slow distribution pipes
    pipes.forEach(function (p) { p.hours = p.dia > 2 ? 0.4 + rand() * 0.6 : 1.2 + rand() * 2.4; });
    // water age: fastest arrival from the plant (Dijkstra)
    nodes.forEach(function (n) { n.age = Infinity; });
    source.age = 0;
    var open = [source], done = new Set();
    while (open.length) {
      open.sort(function (a, b) { return a.age - b.age; });
      var u = open.shift();
      if (done.has(u)) continue;
      done.add(u);
      u.adj.forEach(function (p) {
        var o = other(p, u), t = u.age + p.hours;
        if (t < o.age) { o.age = t; open.push(o); }
      });
    }
    // flow runs from younger to older water
    pipes.forEach(function (p) { if (p.b.age < p.a.age) { var tmp = p.a; p.a = p.b; p.b = tmp; } });
    nodes.forEach(function (n) {
      if (n.age === Infinity) { n.age = null; n.cl = 0; return; }
      if (n.kind === "tank") n.age += 30 + rand() * 24;                     // tank residence time
      else if (n.kind === "junction" && n.adj.length === 1) n.age += 6 + rand() * 14;   // dead-end stagnation
      n.cl = C0 * Math.exp(-K * n.age / 24);
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
    ctx.fillStyle = colorFor(n.cl, 0.95);
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
      var c = q.from.cl + (q.to.cl - q.from.cl) * q.t;
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
      ctx.fillStyle = colorFor(n.cl, (isHover ? 1 : 0.85) * s);
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

  function fmtAge(h) { return h < 36 ? Math.round(h) + " h" : (h / 24).toFixed(1) + " days"; }

  function showProbe(n) {
    if (!n) { probe.hidden = true; return; }
    var html;
    if (n.type === "pump" || n.type === "valve") html = "<strong>" + (n.type === "pump" ? "Pump " : "Valve ") + n.tag + "</strong><br>" + n.detail;
    else if (n.kind === "plant") html = "<strong>Water treatment plant</strong><br>Chlorine leaving: " + C0.toFixed(1) + " mg/L";
    else if (n.kind === "isolated") html = "<strong>Junction J" + n.id + "</strong><br>Not connected to the network";
    else html = "<strong>" + (n.kind === "tank" ? "Storage tank " + n.tag : "Junction J" + n.id) + "</strong><br>Chlorine: " + n.cl.toFixed(2) + " mg/L" + (n.cl < C_LOW ? " (below 0.2)" : "") + "<br>Water age: " + fmtAge(n.age);
    probe.innerHTML = html;
    probe.hidden = false;
    var px = Math.max(8, Math.min(n.x + 14, W - probe.offsetWidth - 8)), py = n.y - probe.offsetHeight - 12;
    if (py < 8) py = n.y + 16;
    probe.style.left = px + "px"; probe.style.top = py + "px";
  }

  function onPoint(e) {
    // no junction labels while pointing at the text, buttons or the note
    if (e.target.closest && e.target.closest(".hero-text, .hero-note")) { if (hover) { hover = null; if (reduceMotion) draw(); } probe.hidden = true; return; }
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

  // redraw when the hero changes size (e.g. the note opens on a phone)
  if ("ResizeObserver" in window) {
    var lastH = 0;
    new ResizeObserver(function () {
      var h = hero.offsetHeight;
      if (Math.abs(h - lastH) > 2) { lastH = h; build(); draw(); }
    }).observe(hero);
  }

  build(); draw(); loop();
})();
