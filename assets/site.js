/* Public site behaviour: home intro, menus, search, catalog filters, series picker, gallery, tender specs, forms, distributor map. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.body.dataset.root || './', lang = document.body.dataset.lang || 'es';
  const t = (es, en) => (lang === 'es' ? es : en);
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[\s\-–·.,]+/g, '');

  // Home intro: loops by itself with no control (owner decision): plays, holds the logo, fades and starts again,
  // only while the hero is on screen. With reduced motion it shows the finished logo once.
  const stage = $('[data-intro]');
  if (stage) {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    let inView = true;
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; }).observe(stage);
    (async () => {
      for (let n = 1; ; n++) {
        stage.dataset.cycle = n;
        const player = FIG.intro(stage, { tagline: stage.dataset.tagline });
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        await player.done; await wait(4000);
        while (!inView || document.hidden) await wait(500);
        await player.svg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 800, fill: 'forwards' }).finished;
      }
    })();
  }

  // Menus.
  const menu = $('#menu');
  $('[data-act="menu"]')?.addEventListener('click', () => menu.showModal());
  $$('[data-act="close"]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  $$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
  $$('.nav details').forEach(d => {
    const close = () => { d.open = false; };
    document.addEventListener('click', e => { if (!d.contains(e.target)) close(); });
    d.addEventListener('keydown', e => { if (e.key === 'Escape' && d.open) { close(); $('summary', d).focus(); } });
    d.addEventListener('focusout', e => { if (!d.contains(e.relatedTarget)) close(); });
  });

  // Search: combobox over search.json (families and models, with applications), accent- and hyphen-insensitive.
  const sd = $('#search'), si = sd && $('input', sd), sr = sd && $('.search-res', sd), sc = sd && $('#search-count');
  let index = null, loading = null, sel = 0;
  const load = () => loading || (loading = fetch(root + 'assets/search.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => (index = d.filter(x => x.lang === lang).map(x => ({ ...x, n: norm(x.code + ' ' + x.name + ' ' + x.q) })))).catch(() => { loading = null; index = null; }));
  const openSearch = () => { sd.showModal(); si.value = ''; si.focus(); render(); load().then(render); };
  function render() {
    if (!index) { sr.innerHTML = `<p class="muted" style="padding:12px">${loading ? t('Cargando…', 'Loading…') : t('No se pudo cargar la búsqueda. Intente de nuevo.', 'Search could not load. Please try again.')}</p>`; return; }
    const q = norm(si.value.trim());
    const hits = (q ? index.filter(x => x.n.includes(q)) : index.filter(x => x.type === 'family')).slice(0, 12);
    sel = 0;
    sr.innerHTML = hits.length ? hits.map((x, i) => `<a role="option" id="sr-${i}" aria-selected="${i === 0}" href="${root}${x.url}" class="${i === 0 ? 'sel' : ''}"><span>${x.code ? `<b>${x.code}</b> · ` : ''}${x.name}</span><span class="k">${x.type === 'family' ? x.meta : ''}</span></a>`).join('')
      : `<p class="muted" style="padding:12px">${t('Sin resultados.', 'No results.')} <a href="${root}${lang === 'es' ? 'contacto' : 'en/contact'}/#cotizar">${t('Describa lo que necesita', 'Describe what you need')}</a></p>`;
    si.setAttribute('aria-activedescendant', hits.length ? 'sr-0' : '');
    sc.textContent = q ? t(`${hits.length} resultados`, `${hits.length} results`) : '';
  }
  if (sd) {
    $('[data-act="search"]')?.addEventListener('click', openSearch);
    si.addEventListener('input', render);
    si.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); sd.close(); return; }
      const items = $$('a[role="option"]', sr); if (!items.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); items[sel].classList.remove('sel'); items[sel].setAttribute('aria-selected', 'false');
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[sel].classList.add('sel'); items[sel].setAttribute('aria-selected', 'true'); si.setAttribute('aria-activedescendant', items[sel].id); items[sel].scrollIntoView({ block: 'nearest' });
      }
      if (e.key === 'Enter') { e.preventDefault(); items[sel].click(); }
    });
    document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); } });
  }

  // Catalog: text + category filter on cards and model rows, live count, empty state.
  const filt = $('[data-filter]'); let cat = '';
  function applyFilter() {
    const q = norm(filt?.value || '');
    let nf = 0, nm = 0;
    $$('#fam-grid .pcard').forEach(c => { const on = norm(c.dataset.q).includes(q) && (!cat || c.dataset.cat === cat); c.hidden = !on; if (on) nf++; });
    $$('#models-table tbody tr').forEach(r => { const on = norm(r.dataset.q).includes(q) && (!cat || r.dataset.cat === cat); r.hidden = !on; if (on) nm++; });
    const cnt = $('[data-count]'); if (cnt) cnt.textContent = cnt.dataset.tpl.replace('{f}', nf).replace('{m}', nm);
    const empty = $('.empty-res'); if (empty) empty.hidden = nf + nm > 0;
  }
  if (filt) {
    filt.addEventListener('input', applyFilter);
    const q0 = new URLSearchParams(location.search).get('q'); if (q0) filt.value = q0;
    applyFilter();
  }
  $$('button[data-cat]').forEach(b => b.addEventListener('click', () => {
    cat = b.dataset.cat; $$('button[data-cat]').forEach(x => x.setAttribute('aria-pressed', x === b)); applyFilter();
  }));

  // Family page: series pills filter the spec table and list the matching models under the pills.
  $$('[data-filter-var]').forEach(r => r.addEventListener('change', () => {
    const rows = $$(`${r.dataset.filterVar} tbody tr`); const shown = [];
    rows.forEach(tr => { tr.hidden = !!r.value && tr.dataset.var !== r.value; if (!tr.hidden) shown.push($('th a', tr)); });
    const res = r.closest('form').querySelector('[data-picker-res]');
    if (res) res.innerHTML = r.value ? `${shown.length} ${res.dataset.label}: ${shown.map(a => `<a href="${a.getAttribute('href')}">${a.textContent}</a>`).join(' · ')}` : '';
  }));

  // Gallery thumbnails.
  $$('.thumbs button').forEach(b => b.addEventListener('click', () => {
    const g = b.closest('.gallery'); $('.main img', g).src = b.dataset.img; $$('.thumbs button', g).forEach(x => x.setAttribute('aria-pressed', x === b));
  }));

  // Tenders: model + version (generic or branded) drive the copyable specification.
  const specSel = $('[data-spec-select]');
  if (specSel) {
    const data = JSON.parse($('#specs-data').textContent); let ver = 0;
    const show = () => { $('#specText').textContent = data[specSel.value][ver]; $('[data-spec-code]').textContent = specSel.value; };
    specSel.addEventListener('change', show);
    const pm = new URLSearchParams(location.search).get('modelo'); if (pm && data[pm]) { specSel.value = pm; show(); }
    $$('[data-spec-ver]').forEach(b => b.addEventListener('click', () => { ver = +b.dataset.specVer; $$('[data-spec-ver]').forEach(x => x.setAttribute('aria-pressed', x === b)); show(); }));
  }
  $$('[data-act="copy"]').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($(b.dataset.target).textContent); toast(t('Especificación copiada', 'Specification copied')); window.FIG?.ack?.(b); } catch { toast(t('Seleccione el texto para copiarlo', 'Select the text to copy it')); }
  }));

  // Contact form: context from the URL (model, product line, topic, document, state); country shows the state field.
  const params = new URLSearchParams(location.search), cf = $('form[data-contact]');
  if (cf) {
    const fams = JSON.parse(cf.dataset.families), topics = JSON.parse(cf.dataset.topics), model = $('input[name="modelo"]', cf), msg = $('textarea', cf);
    if (params.get('modelo')) model.value = params.get('modelo');
    if (params.get('cantidad')) cf.querySelector('input[type=number]').value = params.get('cantidad');
    if (params.get('mensaje')) msg.value = params.get('mensaje');
    else if (params.get('equipo') && fams[params.get('equipo')]) model.value = fams[params.get('equipo')];
    const topic = topics[params.get('tema')];
    if (topic) { $('[data-topic-title]').textContent = topic[0]; $('[data-topic-lead]').textContent = topic[1]; }
    if (params.get('tema') === 'documento' && params.get('doc')) msg.value = t(`Solicito el documento «${params.get('doc')}» de ${params.get('modelo') || ''}.`, `Please send the “${params.get('doc')}” document for ${params.get('modelo') || ''}.`);
    if (params.get('estado')) $('select[name="estado"]', cf).value = params.get('estado');
    const country = $('[data-country]', cf), stateField = $('[data-state-field]', cf);
    const syncCountry = () => { stateField.hidden = country.selectedIndex !== 0; };
    country.addEventListener('change', syncCountry); syncCountry();
  }
  // Forms: POST JSON to the form handler (design/backend/forms). Without an endpoint (preview builds) nothing is sent and the page says so.
  const CFG = window.FIG_CFG || {};
  $$('form[data-form]').forEach(f => {
    if (!$('[data-form-status]', f)) { const p = document.createElement('p'); p.className = 'status full'; p.setAttribute('role', 'status'); p.dataset.formStatus = ''; p.hidden = true; f.appendChild(p); }
    const hp = document.createElement('div'); hp.className = 'hp'; hp.setAttribute('aria-hidden', 'true'); hp.innerHTML = '<label>Website <input name="website" tabindex="-1" autocomplete="off"></label>'; f.appendChild(hp);
    f.addEventListener('submit', async e => {
      e.preventDefault(); if (!f.reportValidity()) return;
      const st = $('[data-form-status]', f), btn = $('button[type=submit], button:not([type])', f);
      const say = (cls, text) => { st.hidden = false; st.className = `status full ${cls}`; st.textContent = text; };
      const data = Object.fromEntries([...new FormData(f)].map(([k, v]) => [k, String(v)]));
      data.form = f.dataset.kind || 'cotizacion'; data.lang = lang; data.page = location.pathname; data.topic = new URLSearchParams(location.search).get('tema') || '';
      if (!CFG.form) return say('', t(`Vista previa: el formulario todavía no está conectado; en el sitio publicado llegará a ${CFG.email} con confirmación automática.`, `Preview: the form is not connected yet; on the live site it reaches ${CFG.email} with an automatic confirmation.`));
      btn && (btn.disabled = true); say('', t('Enviando…', 'Sending…'));
      try {
        const r = await fetch(CFG.form, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) throw new Error(j.error || r.status);
        say('ok', t(`Recibimos su solicitud ${j.ref}. Le enviamos la confirmación a ${data.c3 || data.k4 || data.s6 || 'su correo'}.`, `We received your request ${j.ref}. A confirmation was sent to ${data.c3 || data.k4 || data.s6 || 'your e-mail'}.`));
        f.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=number]), textarea').forEach(x => (x.value = ''));
        window.gtag && gtag('event', 'generate_lead', { form: data.form, topic: data.topic });
      } catch (err) {
        say('alarm', t(`No se pudo enviar. Escríbanos a ${CFG.email} o llame al ${CFG.phone}. Sus datos siguen en el formulario.`, `It could not be sent. Write to ${CFG.email} or call ${CFG.phone}. Your data is still in the form.`));
      } finally { btn && (btn.disabled = false); }
    });
  });

  // Analytics: GA4 only on the production host; events for quote clicks and datasheet downloads.
  if (CFG.ga && location.hostname.replace(/^www\./, '') === CFG.host) {
    const g = document.createElement('script'); g.async = true; g.src = 'https://www.googletagmanager.com/gtag/js?id=' + CFG.ga; document.head.appendChild(g);
    window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments); }; gtag('js', new Date()); gtag('config', CFG.ga);
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a || !window.gtag) return;
    if (a.dataset.ev === 'file_download') gtag('event', 'file_download', { file_name: a.getAttribute('href').split('/').pop() });
    else if (/#cotizar$/.test(a.getAttribute('href') || '')) gtag('event', 'begin_quote', { from: location.pathname });
  });

  // Distributors: the list and state chips work on their own; the map is an enhancement.
  const locs = $$('.loc'); let map = null, marks = [];
  const showState = st => locs.forEach((l, i) => { const on = !st || l.dataset.st === st; l.hidden = !on; if (map) on ? marks[i].addTo(map) : marks[i].remove(); });
  $$('.chips button[data-state]').forEach(c => c.addEventListener('click', () => { $$('.chips button[data-state]').forEach(x => x.setAttribute('aria-pressed', x === c)); showState(c.dataset.state); }));
  locs.forEach((l, i) => $('[data-act="locate"]', l)?.addEventListener('click', () => {
    locs.forEach(x => x.setAttribute('aria-current', x === l));
    if (map) { map.flyTo(marks[i].getLatLng(), 10); marks[i].openPopup(); } else $('#map')?.scrollIntoView({ behavior: 'smooth' });
  }));
  const mapEl = $('#map');
  if (mapEl) {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css);
    const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onerror = () => { const n = $('[data-map-fail]'); if (n) n.hidden = false; mapEl.hidden = true; };
    s.onload = () => {
      map = L.map(mapEl, { scrollWheelZoom: false });
      map.fitBounds([[14.5, -118.4], [32.7, -86.7]]);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
      const pin = L.divIcon({ className: '', html: '<span class="pin"></span>', iconSize: [16, 16] });
      marks = locs.map(b => L.marker([+b.dataset.lat, +b.dataset.lng], { icon: pin, title: $('b', b).textContent }).addTo(map).bindPopup($('b', b).textContent));
      const cur = $('.chips button[data-state][aria-pressed="true"]'); if (cur) showState(cur.dataset.state);
    };
    document.head.appendChild(s);
  }

  // Sticky phone CTA hides while the page's own CTA buttons are on screen.
  const mcta = $('.mcta'), ctas = $('.fam-info .ctas');
  if (mcta && ctas && 'IntersectionObserver' in window) new IntersectionObserver(([e]) => mcta.classList.toggle('away', e.isIntersecting)).observe(ctas);

  // Reveal on scroll.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal').forEach(n => io.observe(n));
  } else $$('.reveal').forEach(n => n.classList.add('in'));

  function toast(msg) {
    let n = $('#toast');
    if (!n) { n = document.createElement('div'); n.id = 'toast'; n.className = 'toast-n'; n.setAttribute('role', 'status'); document.body.appendChild(n); }
    n.textContent = msg; n.hidden = false; clearTimeout(n._t); n._t = setTimeout(() => (n.hidden = true), 3200);
  }
})();

/* Online assistant (demo engine). Answers from the published catalogue (api/products.json + assets/search.json):
   models, product lines, applications, quotes, tenders, service, warranty, distributors. In production the same panel
   talks to an AI service with the catalogue and the price list. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const dlg = $('#assist'); if (!dlg) return;
  const root = document.body.dataset.root || './', L = document.body.dataset.lang || 'es', ES = L === 'es';
  const t = (es, en) => (ES ? es : en);
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const log = $('.as-log', dlg), form = $('.as-form', dlg), input = $('#as-q'), sug = $('.as-sug', dlg);
  const page = k => root + ({ contact: t('contacto/', 'en/contact/'), tenders: t('licitaciones/', 'en/public-tenders/'), service: t('servicio/', 'en/service/'), distributors: t('distribuidores/', 'en/distributors/'), products: t('productos/', 'en/products/') }[k]);
  const LABELS = { control: t('Control', 'Control'), inner: t('Dimensiones interiores', 'Inner dimensions'), power: t('Consumo', 'Power'), cap: t('Capacidad', 'Capacity'), flow: t('Flujo', 'Flow'), outer: t('Dimensiones exteriores', 'Outer dimensions'), type: t('Tipo', 'Type'), desc: t('Descripción', 'Description'), units: t('Plazas', 'Places'), range: t('Rango', 'Range'), series: t('Serie', 'Series') };
  const SYN = [ // keyword → family id
    [/autoclav|esteriliz|steriliz/, 'autoclaves'], [/flujo laminar|laminar|cabina|bioseguridad|biosafety|esteril/, 'campanas-de-flujo-laminar'], [/extraccion|gases|vapor(es)? toxic|fume/, 'campanas-de-extraccion'],
    [/camara|estabilidad|humedad|clima|germina|crecimiento|chamber|stability|humidity|growth/, 'camaras-climaticas'], [/kjeldahl|proteina|nitrogeno|protein|nitrogen/, 'kjeldahl'], [/goldfisch|grasa|\bfat\b/, 'extractores-goldfisch'],
    [/incubad|estufa de cultivo|\bdbo\b|\bbod\b|incubator|cultivo|culture/, 'incubadoras'], [/horno|secado|oven|drying/, 'hornos'], [/bano|maria|flotacion|water bath|\bbath/, 'banos-maria'],
    [/mantilla|matraz|mantle|flask/, 'mantillas'], [/parrilla|agitador|placa|hot plate|stirrer/, 'parrillas'], [/mueble|mobiliario|laboratorio completo|furniture|whole lab/, 'muebles-de-laboratorio']];
  let data = null, history = [];
  try { history = JSON.parse(sessionStorage.getItem('fig-assist-' + L) || '[]'); } catch (e) { history = []; }
  const save = () => { try { sessionStorage.setItem('fig-assist-' + L, JSON.stringify(history.slice(-30))); } catch (e) {} };
  const load = () => data ? Promise.resolve(data) : fetch(root + 'api/products.json').then(r => r.json()).then(j => {
    const models = {}; j.families.forEach(f => f.models.forEach(m => { models[norm(m.code).replace(/[^a-z0-9]/g, '')] = { ...m, fam: f }; }));
    return (data = { fams: j.families, models, warranty: j.warranty });
  }).catch(() => (data = { fams: [], models: {} }));
  const v = x => (x && typeof x === 'object' ? x[L] : x);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rel = url => url.replace(/^https?:\/\/[^/]+\//, root);

  function answer(q) {
    const n = norm(q), compact = n.replace(/[^a-z0-9]/g, ' ');
    // 1. a model code anywhere in the message
    const code = Object.keys(data.models).find(k => k.length >= 4 && compact.replace(/ /g, '').includes(k) && new RegExp('(^|[^a-z0-9])' + k.replace(/(\d)/, '[- ]?$1')).test(n.replace(/[^a-z0-9 -]/g, ' ')));
    const qty = (/\b(\d{1,3})\s*(equipos?|unidades|piezas|units?|pcs)\b/.exec(n) || /\bson (\d{1,3})\b/.exec(n) || [])[1];
    if (code) {
      const m = data.models[code], f = m.fam, specs = Object.entries(m.specs).map(([k, val]) => `${LABELS[k] || k}: ${v(val)}`).join(' · ');
      const tender = /licitac|tender|anexo/.test(n);
      return { text: `${v(f.name)} ${m.code}. ${specs}.${tender ? ' ' + t('En la página de licitaciones puede copiar su especificación en versión genérica, sin marca.', 'On the tenders page you can copy its specification in a generic, brand-free version.') : ''}`,
        links: [[t('Ver el modelo', 'View the model'), rel(m.url[L])], [qty ? t(`Cotizar ${qty} equipos`, `Quote ${qty} units`) : t('Solicitar cotización', 'Request a quote'), `${page('contact')}?modelo=${encodeURIComponent(m.code)}${qty ? '&cantidad=' + qty : ''}#cotizar`], [t('Especificación para licitación', 'Tender specification'), `${page('tenders')}?modelo=${encodeURIComponent(m.code)}`]] };
    }
    if (/servicio|manten|falla|repar|calibr|refacc|service|repair|maintenance|spare|broken/.test(n))
      return { text: t('Damos mantenimiento preventivo, verificación con reporte firmado, reparación y refacciones originales. La calibración acreditada se ofrece bajo solicitud. Indique el equipo y el problema y le confirmamos fecha y presupuesto.', 'We provide preventive maintenance, verification with a signed report, repair and original spare parts. Accredited calibration is available on request. Tell us the unit and the problem and we will confirm the date and estimate.'), links: [[t('Solicitar servicio', 'Request service'), page('service')]] };
    if (/licitac|compranet|comprasmx|anexo|tender|procurement/.test(n))
      return { text: t('Para licitaciones tenemos especificación técnica por modelo, en versión genérica sin marca o con marca, carta de fabricante nacional y garantía. Dígame el modelo o el tipo de equipo y se la preparo.', 'For public tenders we provide a technical specification per model, generic or branded, a national-manufacturer letter and the warranty. Tell me the model or type of equipment.'), links: [[t('Documentación para licitaciones', 'Tender documentation'), page('tenders')]] };
    if (/garantia|warranty/.test(n)) return { text: v(data.warranty) || t('Garantía de un año.', 'One-year warranty.'), links: [] };
    if (/distribu|donde compr|where.*buy|dealer/.test(n)) return { text: t('Puede comprar con un distribuidor de su estado o directamente en planta.', 'You can buy from a distributor in your state or directly from our plant.'), links: [[t('Ver distribuidores', 'See distributors'), page('distributors')]] };
    if (/tiempo de entrega|entrega|cuando llega|lead time|delivery/.test(n)) return { text: /precio|cuesta|price|cost/.test(n) ? t('El precio y el tiempo de entrega dependen del modelo y la cantidad; ambos van en la cotización. Dígame el modelo y cuántos equipos.', 'Price and lead time depend on the model and quantity; both are in the quote. Tell me the model and how many units.') : t('El tiempo de entrega depende del modelo y la cantidad; se confirma en la cotización. Dígame el modelo y se la preparo.', 'Lead time depends on the model and quantity and is confirmed in the quote. Tell me the model.'), links: [[t('Solicitar cotización', 'Request a quote'), page('contact') + '#cotizar']] };
    const fam = SYN.find(([re]) => re.test(n));
    if (fam) {
      const f = data.fams.find(x => x.id === fam[1]);
      if (f) {
        const list = f.models.slice(0, 4).map(m => m.code).join(', ');
        const price = /precio|cuesta|cotiz|price|cost|quote/.test(n);
        return { text: `${v(f.name)}: ${v(f.summary)} ${f.models.length ? t(`Tenemos ${f.models.length} modelos, por ejemplo ${list}.`, `We have ${f.models.length} models, for example ${list}.`) : ''} ${price ? t('Los precios se envían en la cotización, según modelo y cantidad.', 'Prices are sent in the quote, by model and quantity.') : t('¿Qué volumen, capacidad o aplicación necesita? Con eso le sugiero un modelo.', 'What volume, capacity or application do you need? I will suggest a model.')}`,
          links: [[t('Ver la línea', 'View the line'), rel(f.url[L])], [t('Solicitar cotización', 'Request a quote'), `${page('contact')}?equipo=${f.id}#cotizar`]] };
      }
    }
    if (/precio|cuesta|cotiz|price|cost|quote/.test(n)) return { text: t('Con gusto. ¿Qué modelo y cuántos equipos? Si no conoce el modelo, dígame el tipo de equipo y la aplicación.', 'Of course. Which model and how many units? If you do not know the model, tell me the type of equipment and the application.'), links: [[t('Solicitar cotización', 'Request a quote'), page('contact') + '#cotizar']] };
    if (/^(hola|buen|hello|hi\b|gracias|thank)/.test(n)) return { text: /gracias|thank/.test(n) ? t('Con gusto. ¿Algo más?', 'You are welcome. Anything else?') : t('Hola. Puedo ayudarle a elegir un equipo, preparar una cotización, conseguir la especificación para una licitación o solicitar servicio.', 'Hello. I can help you choose equipment, prepare a quote, get a tender specification or request service.'), links: [] };
    const hits = data.fams.filter(f => (f.applications || []).some(a => norm(v(a)).split(/\W+/).some(w => w.length > 4 && n.includes(w))));
    if (hits.length) return { text: t('Para esa aplicación le pueden servir: ', 'For that application you may need: ') + hits.slice(0, 3).map(f => v(f.name)).join(', ') + '.', links: hits.slice(0, 3).map(f => [v(f.name), rel(f.url[L])]) };
    return { text: t('No encuentro esa respuesta en el catálogo. Deje su pregunta y un asesor le responde por correo en un día hábil.', 'I cannot find that in the catalogue. Leave your question and an adviser will reply by e-mail within one business day.'), links: [[t('Enviar la pregunta a un asesor', 'Send the question to an adviser'), `${page('contact')}?tema=asistente&mensaje=${encodeURIComponent(q)}#cotizar`]] };
  }
  function bubble(m) {
    const p = document.createElement('div'); p.className = 'msg ' + m.who;
    p.innerHTML = esc(m.text) + (m.links && m.links.length ? `<div class="as-links">${m.links.map(([l, h]) => `<a href="${esc(h)}">${esc(l)}</a>`).join('')}</div>` : '');
    log.appendChild(p); log.scrollTop = log.scrollHeight;
  }
  function suggestions() {
    const items = [t('¿Qué autoclave me conviene?', 'Which autoclave suits me?'), t('Especificación para licitación', 'Tender specification'), t('Solicitar servicio', 'Request service'), t('Ficha del CH-7090', 'CH-7090 datasheet')];
    sug.innerHTML = items.map(x => `<button type="button">${esc(x)}</button>`).join('');
  }
  function ask(q) {
    q = q.trim(); if (!q) return;
    const me = { who: 'me', text: q }; history.push(me); bubble(me); sug.hidden = true;
    load().then(() => { const a = { who: 'bot', ...answer(q) }; history.push(a); bubble(a); save(); });
  }
  function open(context) {
    if (!dlg.open) dlg.showModal();
    if (!log.children.length) {
      if (history.length) history.forEach(bubble);
      else bubble({ who: 'bot', text: t('Hola, soy el asistente de FIGURSA. Pregúnteme por un equipo, una cotización, una licitación o un servicio.', 'Hello, I am the FIGURSA assistant. Ask me about equipment, a quote, a tender or service.') });
      suggestions();
    }
    if (context) ask(context);
    input.focus();
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-act="assistant"]'); if (b) { e.preventDefault(); open(b.dataset.ask); } });
  sug.addEventListener('click', e => { const b = e.target.closest('button'); if (b) ask(b.textContent); });
  form.addEventListener('submit', e => { e.preventDefault(); ask(input.value); input.value = ''; });
  load();
})();

/* Strategy: simulated live dashboard */
(() => {
  document.querySelectorAll('[data-demo]').forEach(box => {
    const rows = [...box.querySelectorAll('.demo-row')];
    const series = rows.map(r => Array.from({ length: 40 }, (_, i) => +r.dataset.base + Math.sin(i / 4) * +r.dataset.amp));
    const draw = (r, s) => {
      const min = Math.min(...s) - .2, max = Math.max(...s) + .2, pts = s.map((v, i) => `${(i / (s.length - 1) * 118 + 1).toFixed(1)},${(31 - (v - min) / (max - min) * 30).toFixed(1)}`).join(' ');
      r.querySelector('polyline').setAttribute('points', pts);
    };
    const tick = () => {
      rows.forEach((r, k) => {
        const s = series[k]; const next = +r.dataset.base + (Math.random() - .5) * +r.dataset.amp * 1.2; s.push(next); s.shift(); draw(r, s);
        const v = r.querySelector('.val'); if (v) v.textContent = next.toFixed(+r.dataset.dec) + ' ' + r.dataset.unit;
      });
    };
    rows.forEach((r, k) => draw(r, series[k]));
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) setInterval(tick, 2000);
  });
})();
