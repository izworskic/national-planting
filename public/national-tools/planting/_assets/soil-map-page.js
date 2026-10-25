/* Soil temperature map: the latest daily soil reading at every federal soil station in the lower 48,
 * read in the browser on page load (no location needed). USDA SCAN through the AWDB REST API (one
 * request for all stations) and NOAA USCRN through its daily all-station update file. */
(function () {
  'use strict';
  const S = window.SoilStation, svgEl = document.getElementById('sm-map');
  if (!S || !svgEl) return;
  const BASE = '/national-tools/planting/_data/';
  const AWDB = 'https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/data';
  const CRN = 'https://www.ncei.noaa.gov/pub/data/uscrn/products/daily01/updates/';
  const $ = id => document.getElementById(id);
  const svg = (tag, attrs, text) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text !== undefined) e.textContent = text; return e; };
  const make = (tag, attrs, text) => { const e = document.createElement(tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); if (text !== undefined) e.textContent = text; return e; };
  const json = r => { if (!r || !r.ok) throw new Error('HTTP ' + (r && r.status)); return r.json(); };
  const text = r => { if (!r || !r.ok) throw new Error('HTTP ' + (r && r.status)); return r.text(); };
  let map = null, rows = [], mine = null, picked = null;

  function today() {
    const fixed = new URLSearchParams(location.search).get('date');
    if (/^\d{4}-\d{2}-\d{2}$/.test(fixed || '')) return fixed;
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch (_) { return new Date().toISOString().slice(0, 10); }
  }
  const cacheGet = k => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && Date.now() - v.at < 3600e3 ? v.rows : null; } catch (_) { return null; } };
  const cacheSet = (k, rows) => { try { localStorage.setItem(k, JSON.stringify({ at: Date.now(), rows })); } catch (_) { /* private mode */ } };
  // The newest USCRN all-station file: yesterday's is posted the next morning, so fall back a day or two.
  function crnLatest(day, tries) {
    const iso = S.addDays(day, -1), name = 'CRND0103-' + iso.replace(/-/g, '') + '2359.txt';
    return fetch(CRN + iso.slice(0, 4) + '/' + name).then(text).then(S.fromCRNDay).catch(() => (tries > 1 ? crnLatest(iso, tries - 1) : new Map()));
  }

  function load() {
    const day = today(), key = 'soilmap1:' + day, hit = cacheGet(key);
    const stations = fetch(BASE + 'soil/stations.json').then(json), outline = fetch(BASE + 'us-map.json').then(json);
    const live = hit ? Promise.resolve(null) : Promise.all([
      fetch(AWDB + '?stationTriplets=' + encodeURIComponent('*:*:SCAN') + '&elements=STO:-2&duration=DAILY&beginDate=' + S.addDays(day, -4) + '&endDate=' + day).then(json).then(S.latestAWDB).catch(() => new Map()),
      crnLatest(day, 3)
    ]);
    Promise.all([stations, outline, live]).then(([idx, m, got]) => {
      map = m;
      if (hit) rows = hit;
      else {
        const [scan, crn] = got, crnRows = [...crn.values()];
        rows = idx.stations.map(st => {
          let r = null;
          if (st.net === 'SCAN') r = scan.get(st.key) || null;
          else r = crnRows.find(c => Math.abs(c.lat - st.lat) < 0.011 && Math.abs(c.lon - st.lon) < 0.011) || null;
          return r && S.diffDays(r.iso, day) <= 4 ? { id: st.id, n: st.n, st: st.st, net: st.net, lat: st.lat, lon: st.lon, t: r.t, iso: r.iso } : null;
        }).filter(Boolean);
        if (rows.length) cacheSet(key, rows);
      }
      draw();
    }).catch(() => { $('sm-status').textContent = 'The station readings could not be loaded just now.'; });
  }

  function draw() {
    if (!map) return;
    svgEl.setAttribute('viewBox', '0 0 ' + map.W + ' ' + map.H);
    const kids = [svg('path', { d: map.outline, class: 'sm-land' }), svg('path', { d: map.borders, class: 'sm-border' })];
    const sorted = rows.slice().sort((a, b) => a.t - b.t), narrow = (svgEl.getBoundingClientRect().width || 960) < 520;
    for (const r of sorted) {
      const [x, y] = S.project(r.lat, r.lon, map), b = S.band(r.t);
      const c = svg('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: narrow ? 10 : 7, fill: b.color, class: 'sm-dot' + (picked === r.id ? ' on' : '') });
      c.append(svg('title', {}, r.n + ', ' + r.st + ': ' + Math.round(r.t) + '°F on ' + S.fmt(r.iso)));
      kids.push(c);
    }
    if (mine) { const [x, y] = S.project(mine.lat, mine.lon, map); kids.push(svg('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 12, class: 'sm-you' }), svg('text', { x: (x + 15).toFixed(1), y: (y + 5).toFixed(1), class: 'sm-you-label' }, 'You')); }
    svgEl.replaceChildren(...kids);
    const n = rows.length, warm = t => rows.filter(r => r.t >= t).length, last = rows.reduce((a, r) => (r.iso > a ? r.iso : a), '');
    $('sm-status').textContent = n ? n + ' stations reported, latest ' + S.fmt(last) + '. ' + warm(50) + ' are at 50°F or warmer and ' + warm(60) + ' at 60°F or warmer.' : 'No station readings came back just now.';
    $('sm-legend').replaceChildren(...S.BANDS.map(b => { const li = make('li'); const sw = make('span', { class: 'sm-swatch', style: 'background:' + b.color, 'aria-hidden': 'true' }); li.append(sw, make('strong', {}, b.label), document.createTextNode(' ' + b.note + ' (' + rows.filter(r => S.band(r.t) === b).length + ')')); return li; }));
    const tb = $('sm-rows');
    if (tb) tb.replaceChildren(...rows.slice().sort((a, b) => a.st.localeCompare(b.st) || a.n.localeCompare(b.n)).map(r => { const tr = make('tr'); tr.append(make('td', {}, r.st), make('td', {}, r.n), make('td', {}, Math.round(r.t) + '°F'), make('td', {}, S.fmt(r.iso)), make('td', {}, r.net === 'SCAN' ? 'USDA SCAN' : 'NOAA USCRN')); return tr; }));
  }
  // A tap anywhere picks the nearest station, so the small dots work on a phone.
  svgEl.addEventListener('click', e => {
    if (!map || !rows.length) return;
    const box = svgEl.getBoundingClientRect(), x = (e.clientX - box.left) / box.width * map.W, y = (e.clientY - box.top) / box.height * map.H;
    let best = null, bd = Infinity;
    for (const r of rows) { const [px, py] = S.project(r.lat, r.lon, map), d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = r; } }
    if (best && bd < 60) { picked = best.id; caption(best); draw(); }
  });
  function caption(r) { $('sm-pick').textContent = r.n + ', ' + r.st + ': ' + Math.round(r.t) + '°F about 2 inches down on ' + S.fmt(r.iso) + ' (' + (r.net === 'SCAN' ? 'USDA SCAN' : 'NOAA USCRN') + '). ' + S.band(r.t).label + ': ' + S.band(r.t).note + '.'; }

  document.addEventListener('garden:place', e => { const p = e.detail || {}; const lat = Number(p.latitude), lon = Number(p.longitude); mine = Number.isFinite(lat) && Number.isFinite(lon) && lat > 24 && lat < 50 && lon < -66 && lon > -125 ? { lat, lon } : null; draw(); });
  load();
  window.SoilMapPage = { state: () => ({ rows, map }) };
})();
