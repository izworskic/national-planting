/* "Measured soil near you" panel for /national-tools/planting/soil-temperature-ready/.
 * Listens for the place the page's location form resolves (garden:place), finds the nearest federal
 * soil station, reads its measured soil and a forecast in the browser, and says when the soil passes
 * the chosen crop's minimum. The thermometer verdict below it is unchanged and still uses only the
 * reading the gardener enters. No server of ours is involved beyond the existing location lookup. */
(function () {
  'use strict';
  const S = window.SoilStation, G = window.GardenFallDecisions;
  const panel = document.getElementById('soil-station');
  if (!S || !G || !panel || !G.seeds) return;
  const BASE = '/national-tools/planting/_data/soil/';
  const AWDB = 'https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/data';
  const CRN = 'https://www.ncei.noaa.gov/pub/data/uscrn/products/daily01/';
  const OM = 'https://api.open-meteo.com/v1/forecast';
  const $ = id => document.getElementById(id);
  const make = (tag, attrs, text) => { const e = document.createElement(tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); if (text !== undefined) e.textContent = text; return e; };
  const svg = (tag, attrs, text) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); if (text !== undefined) e.textContent = text; return e; };
  let place = null, ctx = null, ask = 0, stations = null;

  function todayIso(zone) {
    const fixed = new URLSearchParams(location.search).get('date');
    if (/^\d{4}-\d{2}-\d{2}$/.test(fixed || '')) return fixed;
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: zone || 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch (_) { return new Date().toISOString().slice(0, 10); }
  }
  const crop = () => { const id = ($('crop') || {}).value || 'beans'; return G.seeds[id] || G.seeds.beans; };
  const json = r => { if (!r || !r.ok) throw new Error('HTTP ' + (r && r.status)); return r.json(); };
  const text = r => { if (!r || !r.ok) throw new Error('HTTP ' + (r && r.status)); return r.text(); };
  const cacheGet = k => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && Date.now() - v.at < 3 * 3600e3 ? v : null; } catch (_) { return null; } };
  const cacheSet = (k, v) => { try { v.at = Date.now(); localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* private mode */ } };

  function loadStations() { return stations ? Promise.resolve(stations) : fetch(BASE + 'stations.json').then(json).then(j => (stations = j)); }
  function measuredFor(st, today) {
    if (st.net === 'SCAN') return fetch(AWDB + '?stationTriplets=' + encodeURIComponent(st.key) + '&elements=STO:-2&duration=DAILY&beginDate=' + S.addDays(today, -200) + '&endDate=' + today).then(json).then(S.fromAWDB);
    const y = Number(today.slice(0, 4)), files = [y];
    if (S.dayOf(today) < 60) files.unshift(y - 1);
    let out = [], chain = Promise.resolve();
    files.forEach(yy => { chain = chain.then(() => fetch(CRN + yy + '/CRND0103-' + yy + '-' + st.key + '.txt').then(text).then(t => { out = out.concat(S.fromCRN(t)); })); });
    return chain.then(() => out.filter(r => r.iso >= S.addDays(today, -200)));
  }
  function modelAt(lat, lon) {
    return fetch(OM + '?latitude=' + lat + '&longitude=' + lon + '&hourly=soil_temperature_6cm&temperature_unit=fahrenheit&timezone=auto&past_days=7&forecast_days=' + S.FORECAST_DAYS).then(json).then(S.fromModel);
  }

  function load(p) {
    place = p; const my = ++ask, lat = Number(p.latitude), lon = Number(p.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const today = todayIso(p.timeZone);
    ctx = { loading: true, today };
    render();
    loadStations().then(idx => {
      const near = S.nearest(idx.stations, [lat, lon]);
      const useStation = near && near.miles <= S.STATION_MILES;
      ctx = { loading: true, today, near, useStation, fetched: idx.fetched };
      const key = 'soilnat1:' + (useStation ? near.station.id : lat.toFixed(2) + ',' + lon.toFixed(2)) + ':' + today, hit = cacheGet(key);
      const hist = near ? fetch(BASE + near.station.id + '.json').then(json).catch(() => null) : Promise.resolve(null);
      let got = { measured: [], model: [] };
      const live = hit ? Promise.resolve(hit) : (near ? measuredFor(near.station, today).catch(() => []) : Promise.resolve([]))
        .then(m => { got.measured = m; return modelAt(useStation ? near.station.lat : lat, useStation ? near.station.lon : lon).catch(() => []); })
        .then(mod => { got.model = mod; if (got.measured.length || got.model.length) cacheSet(key, got); return got; });
      return hist.then(h => live.then(g => { if (my !== ask) return; ctx = Object.assign(ctx, { loading: false, hist: h, measured: g.measured || [], model: g.model || [] }); render(); }));
    }).catch(() => { if (my !== ask) return; ctx = { loading: false, today, failed: true }; render(); });
  }

  // ---------- words ----------
  // Whole degrees, except within a degree of the crop's minimum, where rounding could hide which side it is on.
  let near1 = null;
  const deg = v => { if (near1 !== null && v < near1 && Math.round(v * 10) / 10 >= near1) return 'just under ' + near1 + '°F'; return (near1 !== null && Math.abs(v - near1) < 1 ? (Math.round(v * 10) / 10).toFixed(1) : Math.round(v)) + '°F'; };
  const signed = v => { const r = Math.round(v * 10) / 10; return (r > 0 ? '+' : r < 0 ? '−' : '±') + Math.abs(r) + '°F'; };
  const day = (iso, today) => iso === S.addDays(today, -1) ? 'yesterday' : 'on ' + S.fmt(iso);
  function words(a, c, near) {
    near1 = a.t;
    const where = (place.place || place.displayName || 'your place').split(',')[0], t = a.t, name = c.name.toLowerCase();
    const st = near ? (near.station.net === 'SCAN' ? 'the USDA soil station at ' : 'the NOAA climate station at ') + near.station.n + ', ' + near.station.st + (near.miles >= 1 ? ' (' + near.miles + ' miles away)' : '') : '';
    const src = a.modelOnly ? 'The nearest measuring station is ' + (near ? near.miles + ' miles away' : 'too far away') + ', so this is the weather model’s estimate for your location, not a measurement. ' : '';
    const read = a.last ? (a.modelOnly ? 'The model put the soil about 2 inches down at ' + deg(a.last.t) + ' ' + day(a.last.iso, a.today) + '. ' : 'The soil about 2 inches down averaged ' + deg(a.last.t) + ' ' + day(a.last.iso, a.today) + ' at ' + st + '. ') : '';
    const adj = a.bias ? 'The forecast is shifted by ' + signed(a.bias.offset) + ' to match the station over the last ' + a.bias.days + ' days' + (Math.abs(a.bias.offset) > S.TRUST_GAP ? ', a large gap, so treat it loosely' : '') + '. ' : '';
    const far = !a.modelOnly && near && near.miles > S.WARN_MILES ? 'That station is ' + near.miles + ' miles from you, so read it as a rough guide. ' : '';
    const hist = S.outlookWords(a.outlook, t) + (a.modelOnly && a.outlook.n ? ' (That record is from the station ' + near.miles + ' miles away.)' : '');
    let badge, title, why;
    switch (a.code) {
      case 'WARM_ENOUGH': badge = 'Warm enough'; title = 'The soil near ' + where + ' is warm enough for ' + name + ' (' + t + '°F).'; why = src + read + 'It has stayed at ' + t + '°F or warmer since ' + S.fmt(a.since) + (a.hasForecast ? ', and the forecast keeps it there through ' + S.fmt(a.end.iso) + '. ' : '. ') + adj + far; break;
      case 'FORECAST_WARM': badge = 'Forecast'; title = 'The soil near ' + where + ' should reach ' + t + '°F for ' + name + ' around ' + S.fmt(a.on) + '.'; why = src + read + 'The forecast keeps it at ' + t + '°F or warmer from ' + S.fmt(a.on) + ' through ' + S.fmt(a.end.iso) + '. ' + adj + 'Forecasts drift, so check again in a few days. ' + far; break;
      case 'COOLING': badge = 'Cooling off'; title = 'The soil near ' + where + ' is warm enough for ' + name + ' now, but the forecast cools it' + (a.dip ? ' around ' + S.fmt(a.dip.iso) : '') + '.'; why = src + read + (a.dip ? 'The forecast has it at ' + deg(a.dip.t) + ' on ' + S.fmt(a.dip.iso) + '. ' : '') + adj + far + hist; break;
      case 'NOT_YET': badge = 'Not yet'; title = 'The soil near ' + where + ' won’t stay at ' + t + '°F for ' + name + (a.hasForecast ? ' in the next ' + S.FORECAST_DAYS + ' days.' : ' yet.'); why = src + read + adj + far + hist; break;
      case 'NEXT_SPRING': badge = 'Next spring'; title = a.outlook.median !== null && a.outlook.reached ? 'The soil near ' + where + ' is below ' + t + '°F; in spring it usually stays warm enough for ' + name + ' from about ' + S.when(a.outlook.median) + '.' : 'The soil near ' + where + ' is below ' + t + '°F for ' + name + '.'; why = src + read + far + hist; break;
      default: badge = 'No reading'; title = 'Today’s soil reading near ' + where + ' could not be loaded.'; why = (near ? 'The nearest station is ' + st + '. ' : '') + (a.outlook.n ? hist : '') + ' Use a soil thermometer at seed depth in the morning.';
    }
    return { badge, title, why: why.replace(/\s+/g, ' ').trim() };
  }

  // ---------- chart ----------
  function chart(a, hist, el) {
    const W = Math.max(300, Math.min(900, Math.round(el.getBoundingClientRect().width || 700))), narrow = W < 520, H = narrow ? 220 : 250;
    const today = a.today, past = a.series.filter(r => r.kind !== 'forecast'), fc = a.series.filter(r => r.kind === 'forecast');
    const rows = a.series.length ? a.series : [{ iso: today, t: a.t }];
    const x0 = S.addDays(today, -45), x1 = S.addDays(today, S.FORECAST_DAYS + 1), span = S.diffDays(x0, x1);
    const band = hist && hist.curve ? hist.curve.map((m, i) => ({ d: i * 7, m, lo: hist.lo[i], hi: hist.hi[i] })).filter(p => p.m !== null) : [];
    const inWin = d => { const iso = today.slice(0, 4) + '-' + String(1 + monthOf(d)).padStart(2, '0') + '-' + String(dateOf(d)).padStart(2, '0'); return iso >= x0 && iso <= x1 ? iso : null; };
    const vals = rows.map(r => r.t).concat([a.t], band.filter(p => inWin(p.d)).flatMap(p => [p.lo, p.hi]));
    let lo = Math.floor((Math.min(...vals) - 3) / 10) * 10, hi = Math.ceil((Math.max(...vals) + 3) / 10) * 10; if (hi - lo < 20) hi = lo + 20;
    const L = narrow ? 30 : 38, R = W - 12, T = 16, B = H - 30, X = iso => L + S.diffDays(x0, iso) / span * (R - L), Y = v => B - (v - lo) / (hi - lo) * (B - T);
    el.setAttribute('viewBox', '0 0 ' + W + ' ' + H); el.replaceChildren();
    for (let v = lo; v <= hi; v += 10) el.append(svg('line', { x1: L, y1: Y(v), x2: R, y2: Y(v), class: 'ss-grid' }), svg('text', { x: L - 5, y: Y(v) + 4, 'text-anchor': 'end', class: 'ss-axis' }, v + '°'));
    for (let k = 0; k <= span; k++) { const iso = S.addDays(x0, k); if (iso.slice(8) === '01' || (!narrow && iso.slice(8) === '15')) el.append(svg('text', { x: X(iso), y: B + 18, 'text-anchor': 'middle', class: 'ss-axis' }, S.fmt(iso))); }
    const bandPts = band.map(p => ({ iso: inWin(p.d), p })).filter(q => q.iso);
    if (bandPts.length > 1) {
      el.append(svg('path', { d: 'M' + bandPts.map(q => X(q.iso).toFixed(1) + ' ' + Y(q.p.hi).toFixed(1)).join(' L') + ' L' + bandPts.slice().reverse().map(q => X(q.iso).toFixed(1) + ' ' + Y(q.p.lo).toFixed(1)).join(' L') + ' Z', class: 'ss-band' }));
      el.append(svg('path', { d: 'M' + bandPts.map(q => X(q.iso).toFixed(1) + ' ' + Y(q.p.m).toFixed(1)).join(' L'), class: 'ss-mid' }));
    }
    el.append(svg('line', { x1: L, y1: Y(a.t), x2: R, y2: Y(a.t), class: 'ss-th' }), svg('text', { x: L + 4, y: Y(a.t) - 4, class: 'ss-th-label' }, a.t + '°F minimum'));
    const path = list => list.filter(r => r.iso >= x0).map((r, i) => (i ? 'L' : 'M') + X(r.iso).toFixed(1) + ' ' + Y(r.t).toFixed(1)).join(' ');
    if (past.length) el.append(svg('path', { d: path(past), class: a.modelOnly ? 'ss-model' : 'ss-meas' }));
    if (fc.length) el.append(svg('path', { d: path((past.length ? [past[past.length - 1]] : []).concat(fc)), class: 'ss-fc' }));
    el.append(svg('line', { x1: X(today), y1: T, x2: X(today), y2: B, class: 'ss-today' }), svg('text', { x: X(today) + 4, y: T + 10, class: 'ss-today-label' }, 'Today'));
    const mark = a.code === 'WARM_ENOUGH' && a.since >= x0 ? a.since : a.code === 'FORECAST_WARM' ? a.on : null;
    if (mark) el.append(svg('circle', { cx: X(mark), cy: Y(a.t), r: 6, class: 'ss-mark' }));
  }
  const CUMS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
  const monthOf = d => { let m = 0; while (m < 11 && d >= CUMS[m + 1]) m++; return m; };
  const dateOf = d => d - CUMS[monthOf(d)] + 1;

  // ---------- render ----------
  function render() {
    if (!place) return;
    panel.hidden = false;
    const mi = (place.stateCode || '').toUpperCase() === 'MI';
    const hand = $('ss-michigan');
    hand.hidden = !mi;
    if (mi) $('ss-michigan-link').href = '/michigan-soil-temperature/?place=' + encodeURIComponent(place.postcode || (place.place || '').split(',')[0] || 'Bay City');
    const c = crop();
    if (!ctx || ctx.loading) { $('ss-badge').textContent = 'Checking'; $('ss-title').textContent = 'Reading the nearest measured soil station…'; $('ss-why').textContent = ''; $('ss-facts').replaceChildren(); $('ss-live').textContent = ''; return; }
    if (ctx.failed) { $('ss-badge').textContent = 'No reading'; $('ss-title').textContent = 'The station list could not be loaded. Use a soil thermometer at seed depth.'; $('ss-why').textContent = ''; return; }
    const near = ctx.near, a = S.assess(c.minimum, ctx.today, { measured: ctx.useStation ? ctx.measured : [], model: ctx.model, adjust: !!ctx.useStation, modelOnly: !ctx.useStation }, ctx.hist);
    const w = words(a, c, near);
    $('ss-card').className = 'ss-card ' + ({ WARM_ENOUGH: 'ok', FORECAST_WARM: 'wait', COOLING: 'wait', NOT_YET: 'no', NEXT_SPRING: 'info' }[a.code] || 'info');
    $('ss-badge').textContent = w.badge; $('ss-title').textContent = w.title; $('ss-why').textContent = w.why;
    const facts = [];
    const fx = (k, v) => { facts.push(make('dt', null, k), make('dd', null, v)); };
    if (a.last) fx(a.modelOnly ? 'Model soil, about 2 inches' : 'Measured soil, about 2 inches', deg(a.last.t) + ', ' + S.fmt(a.last.iso));
    if (near) fx('Nearest station', near.station.n + ', ' + near.station.st + ' · ' + (near.station.net === 'SCAN' ? 'USDA SCAN' : 'NOAA USCRN') + ' · ' + near.miles + ' miles');
    fx(c.name + ' minimum', c.minimum + '°F (warmer is better: ' + c.preferred + '°F+)');
    if (a.outlook.n) fx('Typical date at this station', a.outlook.reached ? S.when(a.outlook.median) + ' (' + a.outlook.n + ' springs)' : 'not by June 30');
    fx('Forecast', a.bias ? 'Adjusted ' + signed(a.bias.offset) + ' to the station' : a.modelOnly && a.hasForecast ? 'Weather model at your location, unadjusted' : a.hasForecast ? 'Weather model' : 'Not available');
    $('ss-facts').replaceChildren(...facts);
    $('ss-station-link').hidden = !near;
    if (near) { $('ss-station-link').href = near.station.net === 'SCAN' ? 'https://wcc.sc.egov.usda.gov/nwcc/site?sitenum=' + near.station.key.split(':')[0] : 'https://www.ncei.noaa.gov/access/crn/'; $('ss-station-link').textContent = near.station.n + ' station data'; }
    chart(a, ctx.hist, $('ss-chart'));
    $('ss-chart-note').textContent = (a.modelOnly ? 'Rust line: the weather model at your location (past week and forecast). ' : 'Green line: measured at the station. Dashed rust: the forecast' + (a.bias ? ', adjusted to the station' : '') + '. ') + (ctx.hist && ctx.hist.curve ? 'Shaded: the middle half of past springs at the station.' : '');
    $('ss-live').textContent = w.title;
    if (typeof window.gtag === 'function') window.gtag('event', 'soil_station_answer', { code: a.code, crop: ($('crop') || {}).value, network: near ? near.station.net : 'none', model_only: a.modelOnly });
  }

  document.addEventListener('garden:place', e => load(e.detail));
  const cropSel = $('crop'); if (cropSel) cropSel.addEventListener('change', render);
  window.SoilStationPage = { load, render, state: () => ({ place, ctx }) };
})();
