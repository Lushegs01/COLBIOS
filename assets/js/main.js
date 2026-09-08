/* ============================================================================
   MERIDIAN — landing page behaviour
   No frameworks, no animation library. Everything below is either a CSS
   transition triggered by a class, or a value written into a CSS custom
   property. All scroll work happens in ONE rAF loop so the page never
   thrashes layout; all animated properties are transform/opacity only.
   ========================================================================== */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };

  /* --------------------------------------------------------------- format -- */
  function money(n, decimals) {
    return '$' + n.toLocaleString('en-US', {
      minimumFractionDigits: decimals, maximumFractionDigits: decimals
    });
  }
  function num(n, decimals) {
    return n.toLocaleString('en-US', {
      minimumFractionDigits: decimals, maximumFractionDigits: decimals
    });
  }

  /* Generic value tween. Returns a cancel function. */
  function tween(from, to, ms, onStep) {
    if (REDUCED) { onStep(to); return function () {}; }
    var start = performance.now(), raf;
    function step(now) {
      var t = clamp((now - start) / ms, 0, 1);
      onStep(from + (to - from) * easeOut(t));
      if (t < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return function () { cancelAnimationFrame(raf); };
  }

  /* ============================================================ page load == */
  function boot() {
    // The hero is the page's single orchestrated entrance.
    $$('.hero [data-reveal]').forEach(function (el, i) {
      el.style.setProperty('--rd', (i * 90) + 'ms');
      requestAnimationFrame(function () { el.classList.add('is-in'); });
    });
  }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
  // Safety net: never leave the hero invisible if `load` is slow or blocked.
  setTimeout(boot, 1200);

  /* ========================================================= scroll reveal == */
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      revealIO.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

  // Stagger siblings inside the same grid so a row arrives as a group.
  $$('[data-reveal]').forEach(function (el) {
    if (el.closest('.hero')) return;
    var sibs = Array.prototype.filter.call(el.parentNode.children, function (n) {
      return n.hasAttribute && n.hasAttribute('data-reveal');
    });
    el.style.setProperty('--rd', (sibs.indexOf(el) * 80) + 'ms');
    revealIO.observe(el);
  });

  /* ============================================================= marquees == */
  // Duplicate the content once so a -50% translate loops seamlessly.
  ['[data-ticker]', '[data-logo-track]'].forEach(function (sel) {
    var track = $(sel);
    if (!track) return;
    track.innerHTML += track.innerHTML;
  });

  /* ================================================================== nav == */
  var nav = $('[data-nav]');
  var menuBtn = $('[data-menu-toggle]');
  var menu = $('[data-menu]');

  menuBtn.addEventListener('click', function () {
    var open = menuBtn.getAttribute('aria-expanded') === 'true';
    menuBtn.setAttribute('aria-expanded', String(!open));
    menu.hidden = open;
    menuBtn.querySelector('.u-sr').textContent = open ? 'Open menu' : 'Close menu';
  });
  $$('a', menu).forEach(function (a) {
    a.addEventListener('click', function () {
      menuBtn.setAttribute('aria-expanded', 'false');
      menu.hidden = true;
    });
  });

  /* ================================================= scroll-driven state === */
  var dayRanges = [];   // document-space [start, end] pairs where the page is light
  var sections = [];    // for the section rail
  var railEl = $('.rail');
  var railFill = $('[data-rail-fill]');
  var railLinks = $$('[data-rail-dot]');
  var thread = $('[data-thread]');
  var navH = 0, scrollMax = 1;
  var steps = $('[data-steps]');
  var consoleEl = $('[data-tilt]');

  function measure() {
    var y = window.scrollY;
    dayRanges = [];
    $$('.zone-day').forEach(function (el) {
      var r = el.getBoundingClientRect();
      dayRanges.push([r.top + y, r.bottom + y]);
    });
    // The horizon bands are half night, half day — switch at the terminator.
    var rise = $('.horizon--rise');
    if (rise) { var rr = rise.getBoundingClientRect(); dayRanges.push([rr.top + y + rr.height * 0.5, rr.bottom + y]); }
    var set = $('.horizon--set');
    if (set) { var sr = set.getBoundingClientRect(); dayRanges.push([sr.top + y, sr.top + y + sr.height * 0.45]); }

    sections = railLinks.map(function (a) {
      var el = document.getElementById(a.getAttribute('href').slice(1));
      var r = el.getBoundingClientRect();
      return { link: a, top: r.top + y, bottom: r.bottom + y };
    });

    navH = nav.offsetHeight;
    scrollMax = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  function update() {
    ticking = false;
    var y = window.scrollY;
    var vh = window.innerHeight;

    nav.classList.toggle('is-stuck', y > 12);
    railEl.classList.toggle('is-on', y > vh * 0.75);

    // Light/dark nav depending on which zone sits behind it.
    var probe = y + navH * 0.7;
    var isDay = dayRanges.some(function (r) { return probe >= r[0] && probe < r[1]; });
    nav.classList.toggle('is-day', isDay);

    // Rail: overall progress + current section.
    if (railFill) railFill.style.height = (clamp(y / scrollMax, 0, 1) * 100) + '%';
    var mark = y + vh * 0.34;
    var current = null;
    sections.forEach(function (s) { if (mark >= s.top && mark < s.bottom) current = s.link; });
    railLinks.forEach(function (a) { a.classList.toggle('is-current', a === current); });

    // "How it works" thread draws as the steps pass through the viewport.
    if (thread && steps && !REDUCED) {
      var sr = steps.getBoundingClientRect();
      var p = clamp((vh * 0.82 - sr.top) / (sr.height + vh * 0.3), 0, 1);
      thread.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    }

    // The console lies back slightly, then straightens as it comes into view.
    if (consoleEl && !REDUCED) {
      var cr = consoleEl.getBoundingClientRect();
      var t = clamp((vh - cr.top) / (vh * 0.75), 0, 1);
      consoleEl.style.setProperty('--tilt', (7 * (1 - easeOut(t))).toFixed(2) + 'deg');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { measure(); onScroll(); });
  measure(); update();
  // Re-measure once webfonts settle, since they change section heights.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); update(); });

  // The steps' numbered markers light up individually.
  var stepIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('is-in'); });
  }, { threshold: 0.5 });
  $$('.step').forEach(function (s) { stepIO.observe(s); });

  /* ======================================================= number counters == */
  var counterIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target;
      counterIO.unobserve(el);
      var to = parseFloat(el.dataset.to);
      var dec = parseInt(el.dataset.decimals, 10) || 0;
      tween(0, to, 1500, function (v) { el.textContent = num(v, dec); });
    });
  }, { threshold: 0.6 });
  $$('[data-counter]').forEach(function (el) { counterIO.observe(el); });

  // Hero pill: a settled-payment count that drifts, so the page feels live.
  var live = $('[data-live-count]');
  if (live && !REDUCED) {
    var lo = +live.dataset.countMin, hi = +live.dataset.countMax, cur = +live.textContent.replace(/,/g, '');
    setInterval(function () {
      var next = clamp(cur + Math.round((Math.random() - 0.45) * 34), lo, hi);
      tween(cur, next, 700, function (v) { live.textContent = num(Math.round(v), 0); });
      cur = next;
    }, 2600);
  }

  /* ================================================== hero pointer parallax == */
  var floats = $$('[data-float]');
  var stage = $('.hero__stage');
  if (stage && floats.length && !REDUCED && matchMedia('(pointer: fine)').matches) {
    var px = 0, py = 0, tx = 0, ty = 0, drifting = false;
    stage.closest('.hero').addEventListener('pointermove', function (e) {
      var r = stage.getBoundingClientRect();
      tx = (e.clientX - (r.left + r.width / 2)) / r.width;
      ty = (e.clientY - (r.top + r.height / 2)) / r.height;
      if (!drifting) { drifting = true; requestAnimationFrame(drift); }
    }, { passive: true });

    function drift() {
      px += (tx - px) * 0.08;
      py += (ty - py) * 0.08;
      floats.forEach(function (f) {
        var d = +f.dataset.depth;
        f.style.setProperty('--px', (px * d).toFixed(2) + 'px');
        f.style.setProperty('--py', (py * d).toFixed(2) + 'px');
      });
      if (Math.abs(tx - px) > 0.001 || Math.abs(ty - py) > 0.001) requestAnimationFrame(drift);
      else drifting = false;
    }
  }

  /* ======================================================== tile spotlight == */
  $$('[data-spot]').forEach(function (tile) {
    tile.addEventListener('pointermove', function (e) {
      var r = tile.getBoundingClientRect();
      tile.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      tile.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  });

  /* ================================================================ globe == */
  /* An orthographic dot-sphere. The lit half is gold, the dark half cool —
     the same day/night terminator the whole page is built around.           */
  (function globe() {
    var canvas = $('[data-globe]');
    if (!canvas) return;
    var ctx = canvas.getContext('2d', { alpha: true });
    var wrap = $('[data-globe-wrap]');

    var N = 900, pts = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {                     // Fibonacci sphere
      var y = 1 - (i / (N - 1)) * 2;
      var r = Math.sqrt(Math.max(0, 1 - y * y));
      var th = i * 2.399963229728653;                 // golden angle
      pts[i * 3] = Math.cos(th) * r; pts[i * 3 + 1] = y; pts[i * 3 + 2] = Math.sin(th) * r;
    }

    // Real coordinates, so the routes trace plausible corridors.
    var CITIES = [
      [1.35, 103.82], [6.52, 3.38], [-23.55, -46.63], [51.51, -0.13], [40.71, -74.01],
      [35.68, 139.69], [19.08, 72.88], [25.20, 55.27], [-1.29, 36.82], [-33.87, 151.21],
      [52.52, 13.40], [19.43, -99.13]
    ].map(function (c) {
      var phi = (90 - c[0]) * Math.PI / 180, th = (c[1] + 180) * Math.PI / 180;
      return [-Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)];
    });

    // Great-circle interpolation between two points on the sphere.
    function slerp(a, b, t) {
      var d = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1), o = Math.acos(d);
      if (o < 1e-4) return a.slice();
      var s = Math.sin(o), w1 = Math.sin((1 - t) * o) / s, w2 = Math.sin(t * o) / s;
      return [a[0] * w1 + b[0] * w2, a[1] * w1 + b[1] * w2, a[2] * w1 + b[2] * w2];
    }

    var arcs = [];
    function spawn() {
      var a = (Math.random() * CITIES.length) | 0, b = (Math.random() * CITIES.length) | 0;
      while (b === a) b = (Math.random() * CITIES.length) | 0;
      return { a: CITIES[a], b: CITIES[b], t: -Math.random() * 0.4, speed: 0.0055 + Math.random() * 0.004 };
    }
    for (var k = 0; k < 3; k++) arcs.push(spawn());

    var W = 0, H = 0, dpr = 1, rot = 0.6;
    var SUN = [0.74, 0.20, 0.64];

    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var box = canvas.getBoundingClientRect();
      W = Math.max(1, Math.round(box.width));
      H = Math.max(1, Math.round(box.height));
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function project(p, R, cx, cy) {
      var c = Math.cos(rot), s = Math.sin(rot);
      var x = p[0] * c + p[2] * s, z = -p[0] * s + p[2] * c;
      return [cx + x * R, cy - p[1] * R, z, x, p[1]];
    }

    var BUCKETS = 5;
    function frame() {
      var cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.395;
      ctx.clearRect(0, 0, W, H);

      // Body of the sphere, lit from the upper right, so dots read as a
      // surface rather than a cloud of points.
      var g = ctx.createRadialGradient(cx + R * 0.42, cy - R * 0.36, R * 0.04, cx, cy, R * 1.02);
      g.addColorStop(0,   'rgba(38, 96, 108, .92)');
      g.addColorStop(0.5, 'rgba(13, 49, 63, .78)');
      g.addColorStop(1,   'rgba(5, 22, 30, .42)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill();

      // Sunlit limb.
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, -1.32, 1.06);
      ctx.strokeStyle = 'rgba(255, 205, 122, .75)';
      ctx.lineWidth = 1.3;
      ctx.shadowColor = 'rgba(245, 185, 66, .75)';
      ctx.shadowBlur = 22;
      ctx.stroke();
      ctx.restore();

      // Dots, split day/night and batched into alpha buckets so the whole
      // sphere costs ~10 state changes per frame.
      var day = [], night = [], b;
      for (b = 0; b < BUCKETS; b++) { day.push([]); night.push([]); }
      for (var i = 0; i < N; i++) {
        var pr = project([pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]], R, cx, cy);
        if (pr[2] <= 0.02) continue;
        var lit = pr[3] * SUN[0] + pr[4] * SUN[1] + pr[2] * SUN[2];
        var bi = clamp((pr[2] * BUCKETS) | 0, 0, BUCKETS - 1);
        (lit > 0.04 ? day : night)[bi].push(pr[0], pr[1]);
      }
      for (b = 0; b < BUCKETS; b++) {
        var sz = 1.5 + b * 0.22, o = sz / 2;
        if (day[b].length) {
          ctx.globalAlpha = 0.30 + 0.70 * (b / (BUCKETS - 1));
          ctx.fillStyle = '#FFC65C';
          for (var k1 = 0; k1 < day[b].length; k1 += 2) ctx.fillRect(day[b][k1] - o, day[b][k1 + 1] - o, sz, sz);
        }
        if (night[b].length) {
          ctx.globalAlpha = 0.22 + 0.52 * (b / (BUCKETS - 1));
          ctx.fillStyle = '#7FC6DC';
          for (var k2 = 0; k2 < night[b].length; k2 += 2) ctx.fillRect(night[b][k2] - o, night[b][k2 + 1] - o, sz, sz);
        }
      }
      ctx.globalAlpha = 1;

      // Payment routes in flight.
      arcs.forEach(function (arc, idx) {
        arc.t += arc.speed;
        if (arc.t > 1.5) { arcs[idx] = spawn(); return; }
        if (arc.t <= 0) return;
        var head = Math.min(arc.t, 1), tail = Math.max(0, head - 0.34);
        ctx.lineWidth = 1.5; ctx.lineCap = 'round';
        ctx.beginPath();
        var started = false, hx = 0, hy = 0, hv = false;
        for (var s = tail; s <= head + 1e-6; s += 0.022) {
          var mm = slerp(arc.a, arc.b, clamp(s, 0, 1));
          var lift = 1 + 0.19 * Math.sin(Math.PI * clamp(s, 0, 1));
          var q = project([mm[0] * lift, mm[1] * lift, mm[2] * lift], R, cx, cy);
          if (q[2] <= -0.08) { started = false; continue; }
          if (!started) { ctx.moveTo(q[0], q[1]); started = true; } else ctx.lineTo(q[0], q[1]);
          hx = q[0]; hy = q[1]; hv = true;
        }
        ctx.strokeStyle = 'rgba(255, 214, 140, ' + (0.95 * (1 - Math.max(0, arc.t - 1) / 0.5)).toFixed(3) + ')';
        ctx.stroke();
        if (hv && arc.t <= 1) {
          ctx.save();
          ctx.shadowColor = 'rgba(245, 185, 66, .9)'; ctx.shadowBlur = 10;
          ctx.fillStyle = '#FFE7B0';
          ctx.beginPath(); ctx.arc(hx, hy, 2.4, 0, 6.2832); ctx.fill();
          ctx.restore();
        }
      });
    }

    var running = false, raf = 0;
    function loop() { rot += 0.0016; frame(); raf = requestAnimationFrame(loop); }
    function start() { if (running || REDUCED) return; running = true; raf = requestAnimationFrame(loop); }
    function stop() { running = false; cancelAnimationFrame(raf); }

    size(); frame();
    window.addEventListener('resize', function () { size(); frame(); });

    // Only animate while on screen and while the tab is visible.
    new IntersectionObserver(function (e) { e[0].isIntersecting ? start() : stop(); },
      { threshold: 0.05 }).observe(wrap);
    document.addEventListener('visibilitychange', function () {
      document.hidden ? stop() : start();
    });
  })();

  /* ============================================================ dashboard == */
  (function dashboard() {
    var panel = $('#panel-view');
    if (!panel) return;

    var VIEWS = {
      overview: {
        kpis: { volume: [2847392.44, 2], auth: [96.4, 1], settled: [412908.10, 2], disputes: [0.04, 2] },
        deltas: { volume: '+18.2%', auth: '+1.4 pts', settled: '12 payouts', disputes: '−0.02 pts' },
        series: [42, 46, 44, 52, 58, 55, 63, 61, 70, 68, 77, 74, 82, 88, 84, 93, 99, 96, 108, 114, 110, 122, 128, 137],
        ghost:  [38, 40, 39, 44, 47, 46, 51, 50, 55, 54, 59, 58, 63, 66, 64, 69, 72, 71, 77, 80, 79, 85, 88, 92],
        axis: ['Aug 12', 'Aug 19', 'Aug 26', 'Sep 2', 'Sep 8'],
        rows: [
          ['Northwind Retail', 'Visa ·4242', 'NL', '$1,284.00', 'settled', 'Settled'],
          ['Kestrel Travel', 'iDEAL', 'NL', '$482.50', 'settled', 'Settled'],
          ['Halcyon Software', 'Apple Pay', 'US', '$2,940.00', 'pending', 'Processing'],
          ['Auric Labs', 'SEPA', 'DE', '$18,200.00', 'settled', 'Settled'],
          ['Unrecognized device', 'Visa ·9917', 'RO', '$3,410.00', 'blocked', 'Blocked']
        ]
      },
      payments: {
        kpis: { volume: [1918204.60, 2], auth: [95.8, 1], settled: [286412.75, 2], disputes: [0.06, 2] },
        deltas: { volume: '+11.7%', auth: '+0.9 pts', settled: '8 payouts', disputes: '+0.01 pts' },
        series: [58, 54, 62, 60, 69, 64, 73, 70, 66, 75, 71, 80, 76, 85, 81, 90, 86, 95, 91, 100, 96, 105, 101, 112],
        ghost:  [51, 49, 55, 53, 60, 57, 63, 61, 58, 65, 62, 69, 66, 72, 70, 76, 73, 79, 77, 83, 81, 87, 85, 93],
        axis: ['Sep 1', 'Sep 3', 'Sep 5', 'Sep 6', 'Sep 8'],
        rows: [
          ['Vela Studios', 'Google Pay', 'GB', '$96.00', 'settled', 'Settled'],
          ['Cadence Fitness', 'Mastercard ·1881', 'CA', '$59.00', 'settled', 'Settled'],
          ['Northwind Retail', 'Pix', 'BR', '$740.15', 'settled', 'Settled'],
          ['Kestrel Travel', 'Card ·0043', 'SG', '$4,120.00', 'pending', 'Processing'],
          ['Card testing attempt', 'Visa ·0000', 'US', '$1.00', 'blocked', 'Blocked']
        ]
      },
      payouts: {
        kpis: { volume: [2411880.15, 2], auth: [97.1, 1], settled: [512330.00, 2], disputes: [0.03, 2] },
        deltas: { volume: '+6.4%', auth: '+2.1 pts', settled: '5 payouts', disputes: '−0.01 pts' },
        series: [90, 88, 96, 92, 101, 97, 106, 112, 108, 118, 114, 124, 120, 130, 126, 136, 132, 142, 138, 148, 144, 154, 150, 161],
        ghost:  [82, 80, 86, 84, 90, 88, 94, 98, 96, 103, 100, 107, 105, 112, 110, 116, 114, 120, 118, 124, 122, 128, 126, 133],
        axis: ['Aug 25', 'Aug 29', 'Sep 2', 'Sep 5', 'Sep 8'],
        rows: [
          ['ING · EUR balance', 'SEPA Instant', 'NL', '$182,400.00', 'settled', 'Paid out'],
          ['Chase · USD balance', 'ACH', 'US', '$204,930.00', 'settled', 'Paid out'],
          ['DBS · SGD balance', 'FAST', 'SG', '$88,120.00', 'settled', 'Paid out'],
          ['Barclays · GBP balance', 'Faster Payments', 'GB', '$36,880.00', 'pending', 'In transit'],
          ['Reserve release', 'Internal', '—', '$14,220.00', 'settled', 'Released']
        ]
      }
    };

    var lineEl = $('[data-chart-line]'), areaEl = $('[data-chart-area]'), ghostEl = $('[data-chart-ghost]');
    var axisEl = $('[data-chart-axis]'), body = $('[data-ledger]'), chart = $('.chart');
    var W = 800, H = 240, PAD = 12;

    function points(series) {
      var max = Math.max.apply(null, series) * 1.12, min = 0;
      return series.map(function (v, i) {
        return [(i / (series.length - 1)) * W, H - PAD - ((v - min) / (max - min)) * (H - PAD * 2)];
      });
    }
    // Catmull-Rom through the points, converted to cubic beziers.
    function smooth(p) {
      var d = 'M' + p[0][0].toFixed(1) + ' ' + p[0][1].toFixed(1);
      for (var i = 0; i < p.length - 1; i++) {
        var p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
        d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) +
             ',' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) +
             ',' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
      }
      return d;
    }

    var cancels = [];
    function render(key, animate) {
      var v = VIEWS[key];
      var line = smooth(points(v.series));
      lineEl.setAttribute('d', line);
      areaEl.setAttribute('d', line + ' L' + W + ' ' + H + ' L0 ' + H + ' Z');
      ghostEl.setAttribute('d', smooth(points(v.ghost)));

      if (animate && !REDUCED) {
        var len = lineEl.getTotalLength();
        lineEl.style.transition = 'none';
        lineEl.style.strokeDasharray = len;
        lineEl.style.strokeDashoffset = len;
        chart.classList.remove('is-drawn');
        requestAnimationFrame(function () {
          lineEl.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1)';
          lineEl.style.strokeDashoffset = 0;
          chart.classList.add('is-drawn');
        });
      } else {
        lineEl.style.strokeDasharray = 'none';
        chart.classList.add('is-drawn');
      }

      axisEl.innerHTML = v.axis.map(function (t) { return '<span>' + t + '</span>'; }).join('');

      cancels.forEach(function (c) { c(); }); cancels = [];
      Object.keys(v.kpis).forEach(function (k) {
        var el = $('[data-kpi="' + k + '"]');
        var target = v.kpis[k][0], dec = v.kpis[k][1];
        var suffix = (k === 'auth' || k === 'disputes') ? '%' : '';
        var fmt = (k === 'volume' || k === 'settled') ? money : num;
        cancels.push(tween(0, target, animate ? 1100 : 0, function (n) {
          el.textContent = fmt(n, dec) + suffix;
        }));
        var d = $('[data-kpi="' + k + 'Delta"]');
        if (d) d.textContent = v.deltas[k];
      });

      body.innerHTML = v.rows.map(function (r) {
        return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td>' +
               '<td class="ledger__num">' + r[3] + '</td>' +
               '<td><span class="state state--' + r[4] + '">' + r[5] + '</span></td></tr>';
      }).join('');
    }

    var tabs = $$('.tab');
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      panel.setAttribute('aria-labelledby', tab.id);
      $('.console__url').textContent = 'app.meridian.com/' + tab.dataset.tab;
      render(tab.dataset.tab, true);
      if (focus) tab.focus();
    }
    tabs.forEach(function (t) { t.addEventListener('click', function () { select(t); }); });
    $('.console__tabs').addEventListener('keydown', function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); select(tabs[(i + 1) % tabs.length], true); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); select(tabs[(i - 1 + tabs.length) % tabs.length], true); }
    });

    $('[data-compare]').addEventListener('change', function (e) {
      chart.classList.toggle('is-comparing', e.target.checked);
    });

    render('overview', false);
    // Draw the line only once the console is actually on screen.
    new IntersectionObserver(function (entries, obs) {
      if (!entries[0].isIntersecting) return;
      obs.disconnect();
      render('overview', true);
    }, { threshold: 0.25 }).observe($('.console'));
  })();

  /* ============================================================== pricing == */
  (function pricing() {
    var toggle = $('[data-billing]');
    if (!toggle) return;
    var opts = $$('.billing__opt');
    var per = $('[data-per]');

    toggle.addEventListener('change', function () {
      var annual = toggle.checked;
      opts[0].classList.toggle('is-on', !annual);
      opts[1].classList.toggle('is-on', annual);
      if (per) per.textContent = annual ? '/month, billed yearly' : '/month';

      $$('[data-price]').forEach(function (el) {
        var from = parseFloat(el.textContent.replace(/[^0-9.]/g, '')) || 0;
        var to = parseFloat(annual ? el.dataset.annual : el.dataset.monthly);
        tween(from, to, 420, function (v) { el.textContent = '$' + Math.round(v); });
      });
    });
  })();

  /* ================================================================== faq == */
  $$('.faq__q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq__item');
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      var open = btn.getAttribute('aria-expanded') === 'true';

      if (open) {
        btn.setAttribute('aria-expanded', 'false');
        item.classList.remove('is-open');
        // Wait for the collapse transition before removing it from the a11y tree.
        setTimeout(function () {
          if (btn.getAttribute('aria-expanded') === 'false') panel.hidden = true;
        }, 420);
      } else {
        panel.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(function () { item.classList.add('is-open'); });
      }
    });
  });

  /* ============================================================ signup form -- */
  (function signup() {
    var form = $('[data-signup]');
    if (!form) return;
    var field = $('.field', form), input = $('#email'), msg = $('[data-form-msg]');
    var rest = 'Free forever on Starter. No card required.';

    input.addEventListener('input', function () {
      field.classList.remove('is-invalid');
      msg.classList.remove('is-error');
      if (msg.textContent !== rest && !msg.classList.contains('is-done')) msg.textContent = rest;
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim());
      msg.classList.remove('is-done', 'is-error');
      if (!ok) {
        field.classList.add('is-invalid');
        msg.classList.add('is-error');
        msg.textContent = 'Enter a work email address so we can send your test keys.';
        input.focus();
        return;
      }
      field.classList.remove('is-invalid');
      msg.classList.add('is-done');
      msg.textContent = 'Check ' + input.value.trim() + ' — your test keys are on the way.';
      form.reset();
    });
  })();

})();
