/* Measured soil near you: the engine for /national-tools/planting/soil-temperature-ready/.
 *
 * Three sources, each labelled where it is shown:
 *   measured  The nearest federal soil station: USDA NRCS Soil Climate Analysis Network (SCAN, 2-inch
 *             sensor, AWDB daily value) or NOAA U.S. Climate Reference Network (USCRN, 5 cm daily average).
 *   forecast  Open-Meteo model soil temperature at 6 cm, hourly, averaged per day. When the station is
 *             within STATION_MILES of the place, the model is read at the station and shifted by the average
 *             station-minus-model gap over the last 7 days (past WARN_MILES the page says to read it as a rough
 *             guide). Farther away the model is read at the place itself, unadjusted, and labelled as a model.
 *   history   The same station's measured springs, Jan 1 to Jun 30, 2016 to 2026 (_data/soil/<id>.json).
 *
 * The temperatures are each crop's minimum soil temperature for germination from the crop table in
 * garden-spring-decisions-engine.js (University of Maryland Extension; the same minimums appear in
 * J. F. Harrington's table published by Oregon State University Extension). One rule is this site's
 * own and is disclosed on the page: the soil counts as warm enough from the first day its daily
 * average stays at or above the minimum for the rest of the data, for at least 3 days.
 *
 * A station or model reading is regional evidence. A thermometer in your own bed is the final word,
 * and the page's existing verdict still uses only the reading you enter.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SoilStation = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const FORECAST_DAYS = 16, BIAS_DAYS = 7, MIN_BIAS_DAYS = 3, WARN_MILES = 40, STATION_MILES = 75, TRUST_GAP = 8, STALE_DAYS = 4;
  const THRESHOLDS = [35, 40, 50, 60];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];

  const num = v => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) && n > -40 && n < 130 ? n : null; };
  const utc = iso => { const p = String(iso).split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); };
  const addDays = (iso, n) => new Date(utc(iso) + n * 864e5).toISOString().slice(0, 10);
  const diffDays = (a, b) => Math.round((utc(b) - utc(a)) / 864e5);
  const fmt = iso => { const p = iso.split('-').map(Number); return MONTHS[p[1] - 1] + ' ' + p[2]; };
  /** Day of a common year, 0 = Jan 1. */
  const dayOf = iso => { const p = iso.split('-').map(Number); return CUM[p[1] - 1] + Math.min(p[2], CUM[p[1]] - CUM[p[1] - 1]) - 1; };
  const dayText = d => { for (let m = 0; m < 12; m++) if (d < CUM[m + 1]) return MONTHS[m] + ' ' + (d - CUM[m] + 1); return 'Dec 31'; };
  const warm = (v, t) => v !== null && v !== undefined && v >= t;
  function miles(a, b) { const R = 3958.8, r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r; const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); }

  /** stations: [{id, net, key, n, st, lat, lon}] -> {station, miles} */
  function nearest(stations, pt) {
    let best = null, bm = Infinity;
    for (const s of stations) { const m = miles(pt, [s.lat, s.lon]); if (m < bm) { bm = m; best = s; } }
    return best ? { station: best, miles: Math.round(bm) } : null;
  }

  // ---------- responses -> daily series [{iso, t}] ----------
  /** USDA AWDB REST /data response for STO:-2, DAILY (°F). */
  function fromAWDB(json) {
    const vals = json && json[0] && json[0].data && json[0].data[0] && json[0].data[0].values;
    if (!Array.isArray(vals)) return [];
    return vals.map(v => ({ iso: String(v.date).slice(0, 10), t: num(v.value) })).filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.iso));
  }
  /** NOAA USCRN daily01 text file: column 24 is SOIL_TEMP_5_DAILY in °C, -9999 missing. */
  function fromCRN(text) {
    const out = [];
    for (const line of String(text || '').split('\n')) {
      const c = line.trim().split(/\s+/); if (c.length < 28 || !/^\d{8}$/.test(c[1])) continue;
      const t = Number(c[23]);
      out.push({ iso: c[1].slice(0, 4) + '-' + c[1].slice(4, 6) + '-' + c[1].slice(6, 8), t: Number.isFinite(t) && t > -99 ? Math.round((t * 9 / 5 + 32) * 10) / 10 : null });
    }
    return out;
  }
  /** Open-Meteo hourly soil_temperature_6cm -> daily averages (a day needs 20 of 24 hours). */
  function fromModel(json) {
    const h = json && json.hourly, times = h && h.time, vals = h && h.soil_temperature_6cm;
    if (!times || !vals || times.length !== vals.length) return [];
    const unit = json.hourly_units && json.hourly_units.soil_temperature_6cm;
    const toF = unit && /C/.test(unit) && !/F/.test(unit) ? c => c * 9 / 5 + 32 : f => f;
    const days = new Map();
    times.forEach((t, i) => { const iso = String(t).slice(0, 10), v = num(vals[i]); if (!days.has(iso)) days.set(iso, []); if (v !== null) days.get(iso).push(toF(v)); });
    return [...days].filter(([, a]) => a.length >= 20).map(([iso, a]) => ({ iso, t: a.reduce((s, x) => s + x, 0) / a.length }));
  }
  /** Mean of (station - model) over the last BIAS_DAYS measured days that both have. */
  function bias(measured, model) {
    const m = new Map(model.map(r => [r.iso, r.t]));
    const pairs = measured.filter(r => r.t !== null && m.has(r.iso)).slice(-BIAS_DAYS);
    if (pairs.length < MIN_BIAS_DAYS) return null;
    const gaps = pairs.map(r => r.t - m.get(r.iso));
    return { offset: gaps.reduce((s, x) => s + x, 0) / gaps.length, days: pairs.length };
  }

  /** Albers equal-area conic for the lower 48 (parallels 29.5 and 45.5, origin 37.5N 96W), scaled by the
   * k/tx/ty in _data/us-map.json, so station points land on the outline drawn from the same projection. */
  function project(lat, lon, m) {
    const r = Math.PI / 180, p1 = 29.5 * r, p2 = 45.5 * r, p0 = 37.5 * r, l0 = -96 * r;
    const n = (Math.sin(p1) + Math.sin(p2)) / 2, C = Math.cos(p1) ** 2 + 2 * n * Math.sin(p1), rho0 = Math.sqrt(C - 2 * n * Math.sin(p0)) / n;
    const rho = Math.sqrt(C - 2 * n * Math.sin(lat * r)) / n, th = n * (lon * r - l0);
    return [rho * Math.sin(th) * m.k + m.tx, m.ty - (rho0 - rho * Math.cos(th)) * m.k];
  }
  /** USCRN daily01 "updates" file (every station, one day): -> Map(stationKeyPrefix WBAN -> {iso, t}). */
  function fromCRNDay(text) {
    const out = new Map();
    for (const line of String(text || '').split('\n')) {
      const c = line.trim().split(/\s+/); if (c.length < 28 || !/^\d{8}$/.test(c[1])) continue;
      const t = Number(c[23]);
      if (Number.isFinite(t) && t > -99) out.set(c[0], { iso: c[1].slice(0, 4) + '-' + c[1].slice(4, 6) + '-' + c[1].slice(6, 8), t: Math.round((t * 9 / 5 + 32) * 10) / 10, lat: Number(c[4]), lon: Number(c[3]) });
    }
    return out;
  }
  /** AWDB response for many stations -> Map(triplet -> latest {iso, t}). */
  function latestAWDB(json) {
    const out = new Map();
    for (const st of Array.isArray(json) ? json : []) {
      const vals = st && st.data && st.data[0] && st.data[0].values; if (!vals) continue;
      for (let i = vals.length - 1; i >= 0; i--) { const t = num(vals[i].value); if (t !== null) { out.set(st.stationTriplet, { iso: String(vals[i].date).slice(0, 10), t }); break; } }
    }
    return out;
  }
  /** Map colour bands, tied to the crop minimums. */
  const BANDS = [
    { max: 35, label: 'Below 35°F', note: 'too cold to sow', color: '#3b5b92' },
    { max: 40, label: '35 to 39°F', note: 'lettuce, spinach', color: '#7aa6cf' },
    { max: 50, label: '40 to 49°F', note: 'peas, radishes, carrots, beets', color: '#a9cf9a' },
    { max: 60, label: '50 to 59°F', note: 'sweet corn', color: '#efc350' },
    { max: 70, label: '60 to 69°F', note: 'beans, squash, cucumbers, melons', color: '#e07b39' },
    { max: Infinity, label: '70°F and up', note: 'warm-season seed', color: '#a8382a' }
  ];
  const band = t => BANDS.find(b => t < b.max);

  // ---------- the rule ----------
  /** First day from which every later day in the series is warm (gaps skipped), with at least 3 such days. */
  function settled(series, t) {
    let start = null, run = 0;
    for (const r of series) { if (r.t === null) continue; if (warm(r.t, t)) { if (!start) start = r; run++; } else { start = null; run = 0; } }
    return start && run >= 3 ? start : null;
  }

  // ---------- history ----------
  /** hist: {y0, x35:[...], x40, x50, x60} where each value is the day of year (0 = Jan 1) the spring settled,
   * 0 = already warm on Jan 1, -1 = not by Jun 30, null = no usable record. */
  function outlook(hist, t) {
    const xs = (hist && hist['x' + t]) || [], years = [], ds = []; let never = 0;
    xs.forEach((v, i) => { if (v === null) return; years.push(hist.y0 + i); if (v === -1) never++; else ds.push(v); });
    ds.sort((a, b) => a - b);
    const median = ds.length ? (ds.length % 2 ? ds[(ds.length - 1) / 2] : Math.round((ds[ds.length / 2 - 1] + ds[ds.length / 2]) / 2)) : null;
    return { n: years.length, reached: ds.length, never, median, earliest: ds.length ? ds[0] : null, latest: ds.length ? ds[ds.length - 1] : null, from: years[0] || null, to: years[years.length - 1] || null, allSpring: ds.length && ds.every(d => d === 0) };
  }
  const when = d => d === 0 ? 'before Jan 1' : dayText(d);
  function outlookWords(o, t) {
    if (!o.n) return 'This station has no full spring of records yet.';
    if (o.reached && o.allSpring) return `In every spring measured here (${o.n}, ${o.from} to ${o.to}) the soil stayed at ${t}°F or warmer from Jan 1 on.`;
    if (!o.reached) return `In none of the ${o.n} springs measured here (${o.from} to ${o.to}) did the soil stay at ${t}°F or warmer by June 30.`;
    const share = o.reached === o.n ? `all ${o.n}` : `${o.reached} of the ${o.n}`;
    return `In ${share} springs measured here (${o.from} to ${o.to}) the soil stayed at ${t}°F or warmer by June 30. The middle date was ${when(o.median)}` + (o.reached > 1 ? `, the earliest ${when(o.earliest)} and the latest ${when(o.latest)}.` : '.');
  }

  // ---------- the answer ----------
  /** data: {measured:[{iso,t}], model:[{iso,t}], adjust:boolean}. Returns everything the panel shows. */
  function assess(t, todayIso, data, hist) {
    data = data || {};
    const measured = (data.measured || []).filter(r => r.iso < todayIso);
    const model = data.model || [];
    let last = null; for (let i = measured.length - 1; i >= 0; i--) if (measured[i].t !== null) { last = measured[i]; break; }
    if (data.modelOnly) last = null;
    const stale = !last || diffDays(last.iso, todayIso) > STALE_DAYS;
    const b = !stale && data.adjust ? bias(measured, model) : null;
    const useModel = !stale && model.length && (data.adjust ? b !== null : true);
    const series = (stale ? [] : measured.filter(r => r.t !== null).map(r => ({ iso: r.iso, t: r.t, kind: 'measured' })));
    const lastIso = series.length ? series[series.length - 1].iso : addDays(todayIso, -1);
    if (useModel) for (const r of model) if (r.iso > lastIso) series.push({ iso: r.iso, t: r.t + (b ? b.offset : 0), kind: 'forecast' });
    // Model only: no usable station (too far, or its reading is stale) but the model loaded.
    const modelOnly = stale && !!data.modelOnly && model.length > 0;
    if (modelOnly) for (const r of model) series.push({ iso: r.iso, t: r.t, kind: r.iso < todayIso ? 'model' : 'forecast' });
    const o = outlook(hist, t), springHalf = dayOf(todayIso) < 181;
    const out = { t, today: todayIso, last, stale, modelOnly, bias: b, adjusted: !!b, series, outlook: o, hasForecast: series.some(r => r.kind === 'forecast'), end: series[series.length - 1] || null, springHalf };
    if (modelOnly) { const past = series.filter(r => r.kind === 'model'); last = past[past.length - 1] || null; out.last = last; }
    if (!last || (stale && !modelOnly)) { out.code = 'NO_LIVE'; return out; }
    const wk = (modelOnly ? series.filter(r => r.kind === 'model') : measured).filter(r => r.t !== null && r.iso <= addDays(last.iso, -6)).slice(-1)[0];
    out.trend = wk ? last.t - wk.t : null;
    const s = settled(series, t);
    if (s && s.kind !== 'forecast') { out.code = 'WARM_ENOUGH'; out.since = s.iso; return out; }
    if (s) { out.code = 'FORECAST_WARM'; out.on = s.iso; return out; }
    if (warm(last.t, t)) { out.code = 'COOLING'; out.dip = series.find(r => r.kind === 'forecast' && !warm(r.t, t)) || null; return out; }
    out.code = springHalf ? 'NOT_YET' : 'NEXT_SPRING';
    return out;
  }

  return { project, fromCRNDay, latestAWDB, BANDS, band, FORECAST_DAYS, BIAS_DAYS, WARN_MILES, STATION_MILES, TRUST_GAP, THRESHOLDS, miles, nearest, fromAWDB, fromCRN, fromModel, bias, settled, outlook, outlookWords, assess, addDays, diffDays, fmt, dayOf, dayText, when, warm };
});
