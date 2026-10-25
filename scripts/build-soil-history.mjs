#!/usr/bin/env node
/**
 * Builds the measured soil history the soil page reads, from data/soil-2in-daily.json
 * (scripts/fetch-soil-history.mjs). Offline and deterministic; tests rebuild it and compare.
 *
 *   node scripts/build-soil-history.mjs           write public/national-tools/planting/_data/soil/
 *   node scripts/build-soil-history.mjs --check   fail if the committed files differ
 *
 * Output: _data/soil/stations.json (every station with a usable spring) and one <id>.json per
 * station with the day each spring settled at 35, 40, 50 and 60°F and a typical curve.
 *
 * Quality checks, before any date is worked out:
 *   1. A day outside 10 to 110°F is dropped.
 *   2. A day is dropped as a sensor fault when its gap to the median of the nearest stations within
 *      150 miles (at least three reporting) departs by more than 12°F from that station's usual gap that
 *      spring. Comparing departures, not raw values, keeps real climate extremes (Death Valley, high
 *      mountains). Stations with fewer neighbours skip this check.
 *   3. A spring (Jan 1 to Jun 30, 181 days) is used only with at least 165 days, no gap over 7 days and
 *      no more than 10 fault days. Otherwise it is left out, not filled in.
 * Each usable spring then gets, per temperature, the day from which every later day through June 30
 * stayed at or above it (SoilStation.settled, the same rule the page applies to live data).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = require(path.join(root, 'public/national-tools/planting/_assets/soil-station-engine.js'));
const RAW = path.join(root, 'data', 'soil-2in-daily.json');
const OUT = path.join(root, 'public', 'national-tools', 'planting', '_data', 'soil');
const N = 181, MIN_DAYS = 165, MAX_GAP = 7, SPIKE = 12, RADIUS = 150, NEIGHBOURS = 5, MAX_SPIKES = 10;
const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const quant = (a, q) => { const s = [...a].sort((x, y) => x - y), i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const r1 = v => Math.round(v * 10) / 10;
const isoOf = (y, i) => new Date(Date.UTC(y, 0, 1 + i + (i >= 59 && y % 4 === 0 ? 1 : 0))).toISOString().slice(0, 10);

export function build(raw) {
  const ids = raw.stations.map(s => s.id), byId = Object.fromEntries(raw.stations.map(s => [s.id, s]));
  const near = {};
  for (const s of raw.stations) near[s.id] = raw.stations.filter(o => o.id !== s.id).map(o => [o.id, S.miles([s.lat, s.lon], [o.lat, o.lon])]).filter(x => x[1] <= RADIUS).sort((a, b) => a[1] - b[1]).map(x => x[0]);
  const qc = { daysOutOfRange: 0, daysSpike: 0, springsKept: 0, springsDropped: 0 };
  const clean = {};
  for (const id of ids) { clean[id] = {}; for (const y of raw.years) { const v = raw.daily[id] && raw.daily[id][y]; clean[id][y] = v ? v.map(x => { if (x === null) return null; const t = x / 10; if (t < 10 || t > 110) { qc.daysOutOfRange++; return null; } return t; }) : null; } }
  const checked = {}, spikes = {};
  for (const id of ids) {
    checked[id] = {}; spikes[id] = {};
    for (const y of raw.years) {
      const v = clean[id][y]; spikes[id][y] = 0; if (!v) { checked[id][y] = null; continue; }
      // Gap to the neighbours each day, then each day's departure from this spring's usual gap, so a
      // station that is always warmer (a desert floor) or colder (a mountain) is not mistaken for a fault.
      const gap = v.map((t, i) => {
        if (t === null) return null;
        const nb = []; for (const o of near[id]) { const w = clean[o][y]; if (w && w[i] !== null) nb.push(w[i]); if (nb.length === NEIGHBOURS) break; }
        return nb.length >= 3 ? t - median(nb) : null;
      });
      const known = gap.filter(g => g !== null), usual = known.length >= 30 ? median(known) : 0;
      checked[id][y] = v.map((t, i) => {
        if (t === null) return null;
        if (gap[i] !== null && Math.abs(gap[i] - usual) > SPIKE) { qc.daysSpike++; spikes[id][y]++; return null; }
        return t;
      });
    }
  }
  const stations = [], files = {};
  for (const id of ids) {
    const h = { y0: raw.years[0] }, usable = [];
    for (const t of S.THRESHOLDS) h['x' + t] = [];
    for (const y of raw.years) {
      const v = checked[id][y];
      let ok = false;
      if (v) { const have = v.filter(t => t !== null).length; let gap = 0, maxGap = 0; for (const t of v) { gap = t === null ? gap + 1 : 0; maxGap = Math.max(maxGap, gap); } ok = have >= MIN_DAYS && maxGap <= MAX_GAP && spikes[id][y] <= MAX_SPIKES; }
      if (v && !ok) qc.springsDropped++;
      if (!ok) { for (const t of S.THRESHOLDS) h['x' + t].push(null); continue; }
      qc.springsKept++; usable.push(v);
      const series = v.map((t, i) => ({ iso: isoOf(y, i), t }));
      for (const t of S.THRESHOLDS) { const s = S.settled(series, t); h['x' + t].push(s ? S.dayOf(s.iso) : -1); }
    }
    if (!usable.length) continue;
    if (usable.length >= 5) {
      h.curve = []; h.lo = []; h.hi = [];
      for (let p = 0; p * 7 < N; p++) {
        const c = p * 7, vals = [];
        for (const v of usable) { const w = v.slice(Math.max(0, c - 3), Math.min(N, c + 4)).filter(t => t !== null); if (w.length >= 4) vals.push(w.reduce((a, b) => a + b, 0) / w.length); }
        const ok = vals.length >= 5; h.curve.push(ok ? r1(median(vals)) : null); h.lo.push(ok ? r1(quant(vals, 0.25)) : null); h.hi.push(ok ? r1(quant(vals, 0.75)) : null);
      }
    }
    const s = byId[id];
    stations.push({ id, net: s.net, key: s.key, n: s.name, st: s.state, lat: Math.round(s.lat * 1e4) / 1e4, lon: Math.round(s.lon * 1e4) / 1e4, springs: usable.length });
    files[id] = h;
  }
  stations.sort((a, b) => a.st.localeCompare(b.st) || a.n.localeCompare(b.n));
  return { index: { source: raw.source, fetched: raw.fetched, years: [raw.years[0], raw.years[raw.years.length - 1]], qc, stations }, files };
}

export function render(b) {
  const out = { 'stations.json': JSON.stringify(b.index) + '\n' };
  for (const [id, h] of Object.entries(b.files)) out[id + '.json'] = JSON.stringify(h) + '\n';
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = render(build(JSON.parse(fs.readFileSync(RAW, 'utf8'))));
  if (process.argv.includes('--check')) {
    const have = fs.existsSync(OUT) ? fs.readdirSync(OUT).sort() : [];
    const same = have.join() === Object.keys(files).sort().join() && Object.entries(files).every(([f, t]) => fs.readFileSync(path.join(OUT, f), 'utf8') === t);
    console.log(same ? 'soil history matches the measured record' : 'soil history is out of date: run node scripts/build-soil-history.mjs');
    if (!same) process.exitCode = 1;
  } else {
    fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
    for (const [f, t] of Object.entries(files)) fs.writeFileSync(path.join(OUT, f), t);
    const kb = Object.values(files).reduce((s, t) => s + t.length, 0) / 1024;
    console.log('wrote', Object.keys(files).length, 'files,', kb.toFixed(0), 'KB');
  }
}
