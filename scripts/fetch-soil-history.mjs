#!/usr/bin/env node
/**
 * One-time download of measured spring soil temperatures at about 2 inches for the national soil
 * tool (/national-tools/planting/soil-temperature-ready/). Not part of any build or gate: it needs
 * the network, so run it by hand, rarely (once a year after June 30).
 *
 *   node scripts/fetch-soil-history.mjs [--from 2016] [--to 2026]
 *   node scripts/build-soil-history.mjs
 *
 * Sources (both U.S. government, documented, open to browsers):
 *   USDA NRCS Soil Climate Analysis Network (SCAN), AWDB REST API: element STO at -2 inches, daily.
 *   NOAA U.S. Climate Reference Network (USCRN), daily01 files: SOIL_TEMP_5_DAILY (5 cm, °C).
 * Lower 48 states only. Output: data/soil-2in-daily.json, the daily average soil
 * temperature in tenths of a degree F, 181 values from Jan 1 to Jun 30 (Feb 29 skipped).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'data', 'soil-2in-daily.json');
const AWDB = 'https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1';
const CRN = 'https://www.ncei.noaa.gov/pub/data/uscrn/products/daily01';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const FROM = arg('--from', 2016), TO = arg('--to', 2026);
const NOT48 = new Set(['AK', 'HI', 'PR', 'VI', 'GU', 'AS', 'MP']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, kind = 'json') {
  for (let a = 0; a < 4; a++) {
    try { const r = await fetch(url); if (r.status === 404) return null; if (!r.ok) throw new Error('HTTP ' + r.status); return kind === 'json' ? await r.json() : await r.text(); }
    catch { await sleep(2000 * (a + 1)); }
  }
  return null;
}
// Day index 0..180 for Jan 1..Jun 30 of a common year; Feb 29 returns -1.
const CUM = [0, 31, 59, 90, 120, 151, 181];
const idx = (m, d) => (m === 2 && d === 29) || m > 6 ? -1 : CUM[m - 1] + d - 1;

const out = { source: 'USDA NRCS SCAN (AWDB REST, STO -2 in, daily) and NOAA USCRN (daily01, SOIL_TEMP_5_DAILY)', fetched: new Date().toISOString().slice(0, 10), note: 'Daily average soil temperature at 2 in (SCAN) or 5 cm (USCRN), tenths of a degree F, 181 values Jan 1 to Jun 30, Feb 29 skipped. null = missing.', years: [], stations: [], daily: {} };
for (let y = FROM; y <= TO; y++) out.years.push(y);
const blank = () => Object.fromEntries(out.years.map(y => [y, new Array(181).fill(null)]));
const finish = (id) => { for (const y of out.years) if (out.daily[id][y].every(v => v === null)) out.daily[id][y] = null; };

// ---- SCAN ----
const scan = ((await get(`${AWDB}/stations?networkCds=SCAN&activeOnly=true&returnForecastPointMetadata=false&returnReservoirMetadata=false&returnStationElements=false`)) || [])
  .filter(s => s.networkCode === 'SCAN' && !NOT48.has(s.stateCode));
for (const s of scan) {
  const j = await get(`${AWDB}/data?stationTriplets=${encodeURIComponent(s.stationTriplet)}&elements=STO:-2&duration=DAILY&beginDate=${FROM}-01-01&endDate=${TO}-06-30`);
  const vals = (j && j[0] && j[0].data && j[0].data[0] && j[0].data[0].values) || [];
  if (!vals.length) { await sleep(300); continue; }
  const id = 'scan-' + s.stationId;
  out.daily[id] = blank();
  for (const v of vals) {
    const [y, m, d] = v.date.slice(0, 10).split('-').map(Number), i = idx(m, d);
    if (i < 0 || !out.daily[id][y] || v.value === null || v.value === undefined) continue;
    out.daily[id][y][i] = Math.round(Number(v.value) * 10);
  }
  finish(id);
  out.stations.push({ id, net: 'SCAN', key: s.stationTriplet, name: s.name, state: s.stateCode, county: s.countyName || null, lat: s.latitude, lon: s.longitude });
  console.log('SCAN', s.stationTriplet, s.name, vals.length);
  await sleep(300);
}

// ---- USCRN ----
const seen = new Map();
for (const y of out.years) {
  const list = await get(`${CRN}/${y}/`, 'text');
  for (const f of new Set((list || '').match(/CRND0103-\d{4}-[A-Za-z0-9_.-]+\.txt/g) || [])) {
    const stem = f.replace(/^CRND0103-\d{4}-/, '').replace(/\.txt$/, ''), st = stem.slice(0, 2);
    if (NOT48.has(st)) continue;
    if (!seen.has(stem)) seen.set(stem, new Set());
    seen.get(stem).add(y);
  }
}
for (const [stem, ys] of seen) {
  const id = 'crn-' + stem.toLowerCase();
  let lat = null, lon = null;
  out.daily[id] = blank();
  for (const y of [...ys].sort()) {
    const txt = await get(`${CRN}/${y}/CRND0103-${y}-${stem}.txt`, 'text');
    for (const line of (txt || '').split('\n')) {
      const c = line.trim().split(/\s+/); if (c.length < 28) continue;
      const date = c[1], m = Number(date.slice(4, 6)), d = Number(date.slice(6, 8)), i = idx(m, d);
      lon = Number(c[3]); lat = Number(c[4]);
      const t = Number(c[23]);
      if (i < 0 || !isFinite(t) || t <= -99) continue;
      out.daily[id][y][i] = Math.round((t * 9 / 5 + 32) * 10);
    }
    await sleep(250);
  }
  finish(id);
  if (lat === null) { delete out.daily[id]; continue; }
  const name = stem.slice(3).replace(/_/g, ' ');
  out.stations.push({ id, net: 'USCRN', key: stem, name, state: stem.slice(0, 2), county: null, lat, lon });
  console.log('USCRN', stem);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('wrote', path.relative(root, OUT), out.stations.length, 'stations');
