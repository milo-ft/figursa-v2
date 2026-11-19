/* FIGURSA mesh, the brand texture: fine squares on a lattice that thin out and break up away from one edge, like
   graph paper or a filter grid. It is used only as horizontal blocks (title rules, dividers, bands, the footer
   edge), never over the logo, a photo or running text. FIG.mesh(host, options) puts a canvas behind the host's
   content. Every block starts with a solid zone, where every square is drawn at full strength, and then breaks up:
   each cell has a fixed random rank and shows when its rank is below the local density. The far end is cut off
   before it thins to stray squares, so the texture never turns to noise. Options:
     cell, gap      lattice step and the gap between squares (px)
     color, alpha   'r g b' and the alpha where the field thins out and where it is full
     from           where the mesh is dense: 'left', 'right', 'top', 'bottom', or 'center' (thinning to both sides);
                    the lattice sits flush with that edge
     reach          how far the field runs: a fraction of the host's width (left, right, center) or height (top, bottom),
                    or, above 1, in px
     solid          the share of the reach, from the dense edge, that is completely filled
     narrow         options that replace these while the host is narrower than 760px
   It fills in once when it first comes into view, sweeping out from the dense edge, then stays still.
   Reduced motion: drawn filled at once.
   Returns {set(options), fill(), destroy()}. */
(function () {
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = t => 1 - Math.pow(1 - t, 3);
  const rank = (i, j, seed) => { let h = (i * 374761393 + j * 668265263 + seed * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const DEFAULTS = { cell: 10, gap: 2, color: '0 102 204', alpha: [.1, .7], from: 'left', reach: .6, solid: .35, narrow: null, seed: 7, duration: 1300 };

  function mesh(host, options = {}) {
    let base = { ...DEFAULTS, ...options }, o = base;
    const cv = document.createElement('canvas'); cv.className = 'mesh'; cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0';
    host.prepend(cv);
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, xs, ys, ds, ts, n = 0, p = 0, anim = null, raf = 0, filled = false;

    function layout() {
      const r = host.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      o = base.narrow && r.width < 760 ? { ...base, ...base.narrow } : base;
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const c = o.cell, s = c - o.gap, f = o.from, cols = Math.ceil(W / c) + 1, rows = Math.ceil(H / c) + 1;
      const R = o.reach > 1 ? o.reach : o.reach * (f === 'top' || f === 'bottom' ? H : f === 'center' ? W / 2 : W), x0 = f === 'center' ? (W % c - o.gap) / 2 : 0;
      const S = o.solid * R;
      xs = new Float32Array(cols * rows); ys = new Float32Array(cols * rows); ds = new Float32Array(cols * rows); ts = new Float32Array(cols * rows); n = 0;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const x = f === 'right' ? W - i * c - s : x0 + i * c, y = f === 'bottom' ? H - j * c - s : j * c;
        if (x + s <= 0 || x >= W || y + s <= 0 || y >= H) continue;
        const cx = x + s / 2, cy = y + s / 2;
        const dist = { left: cx, right: W - cx, top: cy, bottom: H - cy, center: Math.abs(cx - W / 2) }[f];
        const d = dist <= S ? 1 : Math.pow(Math.max(0, 1 - (dist - S) / (R - S)), 1.3);
        if (d < .12) continue;
        const r0 = rank(i, j, o.seed);
        if (r0 >= d) continue;
        xs[n] = x; ys[n] = y; ds[n] = d; ts[n] = .6 * Math.min(1, dist / R) + .4 * rank(j, i, o.seed + 1); n++;
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const [a0, a1] = o.alpha, s = o.cell - o.gap, q = ease(p);
      ctx.fillStyle = `rgb(${o.color})`;
      for (let k = 0; k < n; k++) {
        if (ts[k] > q) continue;
        ctx.globalAlpha = Math.min(1, a0 + (a1 - a0) * ds[k]); ctx.fillRect(xs[k], ys[k], s, s);
      }
      ctx.globalAlpha = 1;
    }

    function tick(now) {
      raf = 0;
      if (anim) { const t = Math.min(1, (now - anim.t0) / anim.dur); p = t; if (t < 1) raf = requestAnimationFrame(tick); else anim = null; }
      draw();
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    function fill() { filled = true; io.disconnect(); if (reduce()) { p = 1; kick(); return; } p = 0; anim = { t0: performance.now(), dur: o.duration }; kick(); }

    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !filled) fill(); }, { threshold: .15 });
    // the ResizeObserver's first callback does the initial layout
    const ro = new ResizeObserver(() => { layout(); kick(); });
    ro.observe(host);
    if (reduce()) { p = 1; filled = true; } else io.observe(host);

    return {
      set(next) { base = { ...base, ...next }; layout(); kick(); },
      fill,
      destroy() { io.disconnect(); ro.disconnect(); cv.remove(); },
    };
  }

  window.FIG = Object.assign(window.FIG || {}, { mesh });
})();
/* Micro-interactions and scroll composition that go with the mesh. Transform and opacity only; with reduced
   motion every state is final at once.
     [data-countup="140"]      counts up once when it enters the screen
     [data-ack]                a link or button whose icon turns into a check for a moment after use; FIG.ack(el)
                               does it from code, after an action that succeeded
     [data-copy="#id"]         copies that element's text, then acknowledges
     svg[data-draw]            paths with pathLength="1" draw as the element crosses the screen (--draw: 0..1)
     [data-mesh='{…}']         FIG.mesh on that element with those options */
(() => {
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lang = document.documentElement.lang || 'es';

  // Figures count up once.
  const fmt = new Intl.NumberFormat(lang.startsWith('es') ? 'es-MX' : 'en', { useGrouping: false });
  const counter = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; counter.unobserve(e.target);
    const el = e.target, to = +el.dataset.countup;
    if (reduce) { el.textContent = fmt.format(to); return; }
    const t0 = performance.now(), step = now => { const t = Math.min(1, (now - t0) / 1100); el.textContent = fmt.format(Math.round(to * (1 - Math.pow(1 - t, 3)))); if (t < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), { threshold: .6 });
  $$('[data-countup]').forEach(el => { el.textContent = reduce ? el.dataset.countup : '0'; counter.observe(el); });

  // Acknowledge: the icon becomes a check for a moment.
  const ack = el => { el.classList.add('acked'); clearTimeout(el._ack); el._ack = setTimeout(() => el.classList.remove('acked'), 2200); };
  window.FIG = Object.assign(window.FIG || {}, { ack });
  $$('[data-ack]').forEach(el => el.addEventListener('click', () => ack(el)));
  $$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    const text = document.querySelector(b.dataset.copy)?.innerText.trim() || '';
    try { await navigator.clipboard.writeText(text); }
    catch { const t = Object.assign(document.createElement('textarea'), { value: text }); document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); }
    const label = b.querySelector('[data-label]'); if (label) { label.dataset.was ??= label.textContent; label.textContent = label.dataset.done; setTimeout(() => (label.textContent = label.dataset.was), 2200); }
    ack(b);
  }));

  // Lines that draw with the scroll.
  const draws = $$('svg[data-draw]');
  const drawAll = () => draws.forEach(s => {
    const r = s.getBoundingClientRect(), vh = innerHeight;
    s.style.setProperty('--draw', reduce ? 1 : Math.min(1, Math.max(0, (vh * .92 - r.top) / (vh * .55))).toFixed(3));
  });
  if (draws.length) { let q = 0; addEventListener('scroll', () => q || (q = requestAnimationFrame(() => { q = 0; drawAll(); })), { passive: true }); addEventListener('resize', drawAll); drawAll(); }

  // Mesh hosts declared in the markup.
  if (window.FIG?.mesh) $$('[data-mesh]').forEach(el => { el._mesh = FIG.mesh(el, JSON.parse(el.dataset.mesh || '{}')); });
})();
