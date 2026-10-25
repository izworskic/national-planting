// Measured soil near you: engine behaviour, the history it ships, and the page contract.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const S = require('../public/national-tools/planting/_assets/soil-station-engine.js');
const G = require('../public/national-tools/planting/_assets/garden-spring-decisions-engine.js');
const ROOT = path.join(__dirname, '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'public/national-tools/planting/soil-temperature-ready/index.html'), 'utf8');
const DATA = path.join(ROOT, 'public/national-tools/planting/_data/soil');

// A smooth spring: t rises 0.4 F a day from 30 F on Jan 1.
const spring = (from, to, f) => { const out = []; for (let d = from; d <= to; d = S.addDays(d, 1)) out.push({ iso: d, t: f(S.dayOf(d)) }); return out; };
const ramp = d => 30 + 0.4 * d;
// Hourly model response for days [from, to] with a known cold bias and a daily swing that averages out.
const model = (from, to, f, bias) => { const time = [], v = []; for (let d = from; d <= to; d = S.addDays(d, 1)) for (let h = 0; h < 24; h++) { time.push(d + 'T' + String(h).padStart(2, '0') + ':00'); v.push(f(S.dayOf(d)) - bias + 3 * Math.sin(2 * Math.PI * h / 24)); } return { hourly_units: { soil_temperature_6cm: '°F' }, hourly: { time, soil_temperature_6cm: v } }; };

test('parses USDA AWDB and NOAA USCRN responses', () => {
  const awdb = [{ data: [{ values: [{ date: '2026-04-01', value: 48 }, { date: '2026-04-02', value: null }] }] }];
  assert.deepEqual(S.fromAWDB(awdb), [{ iso: '2026-04-01', t: 48 }, { iso: '2026-04-02', t: null }]);
  const line = '54810 20261017  2.622  -86.92   46.33    15.0    -1.5     6.8     6.2     0.0    12.52 C    18.6    -3.6     4.9    87.4    24.9    57.3   0.207   0.204   0.190   0.072   0.330     8.5     9.0     9.0    10.5    11.3';
  const bad = line.replace('     8.5     9.0', ' -9999.0     9.0');
  assert.deepEqual(S.fromCRN(line + '\n' + bad.replace('20261017', '20261018')), [{ iso: '2026-10-17', t: 47.3 }, { iso: '2026-10-18', t: null }]);
});

test('the forecast adjustment recovers a known model bias exactly, and the date matches the truth', () => {
  for (const bias of [-4, 0, 3.5]) for (const today of ['2026-03-20', '2026-04-10', '2026-05-01']) {
    const measured = spring('2026-01-01', S.addDays(today, -1), ramp);
    const mod = S.fromModel(model(S.addDays(today, -7), S.addDays(today, 15), ramp, bias));
    for (const t of S.THRESHOLDS) {
      const a = S.assess(t, today, { measured, model: mod, adjust: true });
      assert.ok(Math.abs(a.bias.offset - bias) < 1e-9, 'bias ' + bias);
      const truth = S.settled(spring('2026-01-01', S.addDays(today, 15), ramp), t);
      const got = a.code === 'WARM_ENOUGH' ? a.since : a.code === 'FORECAST_WARM' ? a.on : null;
      assert.equal(got, truth ? truth.iso : null, `${today} ${t}F ${a.code}`);
    }
  }
});

test('answer states: warm, forecast, cooling, not yet, next spring, no reading, model only', () => {
  const today = '2026-04-10', measured = spring('2026-01-01', '2026-04-09', ramp), mod = S.fromModel(model('2026-04-03', '2026-04-25', ramp, 0));
  assert.equal(S.assess(35, today, { measured, model: mod, adjust: true }).code, 'WARM_ENOUGH');
  assert.equal(S.assess(70, today, { measured, model: mod, adjust: true }).code, 'FORECAST_WARM');
  assert.equal(S.assess(80, today, { measured, model: mod, adjust: true }).code, 'NOT_YET');
  const cool = d => 80 - 1.5 * Math.max(0, d - 280);
  const fall = '2026-10-20', fm = spring('2026-09-01', '2026-10-19', cool), fmod = S.fromModel(model('2026-10-13', '2026-11-04', cool, 0));
  assert.equal(S.assess(60, fall, { measured: fm, model: fmod, adjust: true }).code, 'COOLING');
  assert.equal(S.assess(75, fall, { measured: fm, model: fmod, adjust: true }).code, 'NEXT_SPRING');
  assert.equal(S.assess(60, today, { measured: spring('2026-01-01', '2026-03-01', ramp), model: mod, adjust: true }).code, 'NO_LIVE', 'a month-old reading is not today\'s');
  const only = S.assess(40, today, { measured: [], model: mod, modelOnly: true });
  assert.equal(only.modelOnly, true); assert.equal(only.code, 'WARM_ENOUGH'); assert.equal(only.bias, null);
});

test('crop minimums match the Harrington table (Oregon State University Extension)', () => {
  const harrington = { peas: 40, spinach: 35, lettuce: 35, radish: 40, carrots: 40, beets: 40, beans: 60, sweetcorn: 50, cucumbers: 60, squash: 60, melons: 60 };
  for (const [id, min] of Object.entries(harrington)) assert.equal(G.seeds[id].minimum, min, id);
  for (const c of Object.values(G.seeds)) assert.ok(S.THRESHOLDS.includes(c.minimum), c.name + ' has history at its minimum');
});

test('station history rebuilds from the committed measured record and covers the lower 48', async () => {
  const { build, render } = await import('../scripts/build-soil-history.mjs');
  const files = render(build(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/soil-2in-daily.json'), 'utf8'))));
  const have = fs.readdirSync(DATA).sort();
  assert.deepEqual(have, Object.keys(files).sort());
  for (const [f, t] of Object.entries(files)) assert.equal(fs.readFileSync(path.join(DATA, f), 'utf8'), t, f);
  const idx = JSON.parse(files['stations.json']);
  assert.ok(idx.stations.length >= 250, 'stations ' + idx.stations.length);
  assert.ok(idx.stations.every(s => !['AK', 'HI', 'PR'].includes(s.st) && s.lat > 24 && s.lat < 50 && s.lon < -66 && s.lon > -125));
  assert.ok(new Set(idx.stations.map(s => s.st)).size >= 45, 'states covered');
});

test('page: query-first title, national scope, and Michigan visitors handed to the Michigan tool', () => {
  const title = PAGE.match(/<title>([^<]+)<\/title>/)[1], desc = PAGE.match(/<meta name="description" content="([^"]+)"/)[1], h1 = PAGE.match(/<h1>([^<]+)<\/h1>/)[1];
  assert.match(title, /^Soil Temperature by ZIP Code/); assert.ok(title.length <= 60 && desc.length <= 158);
  for (const s of [title, desc, h1, PAGE.match(/<p class="lede">([^<]+)<\/p>/)[1]]) assert.doesNotMatch(s, /Michigan/i, 'national copy must not compete for Michigan searches');
  assert.match(PAGE, /<p class="ss-hand" id="ss-michigan" hidden>In Michigan\?[^<]*<a id="ss-michigan-link" href="\/michigan-soil-temperature\/">/);
  assert.match(PAGE, /soil-station-engine\.js[\s\S]*soil-station-page\.js/);
  assert.match(PAGE, /id="ss-live" role="status"/);
  assert.match(PAGE, /<svg id="ss-chart" role="img" aria-labelledby=/);
  assert.match(PAGE, /<form class="locator" id="place"/, 'the thermometer verdict and location form stay');
  assert.doesNotMatch(PAGE, /—/);
  const page = fs.readFileSync(path.join(ROOT, 'public/national-tools/planting/_assets/soil-station-page.js'), 'utf8');
  assert.match(page, /stateCode[^\n]*=== 'MI'/);
  assert.match(fs.readFileSync(path.join(ROOT, 'public/national-tools/planting/_assets/garden-fall-decisions-page.js'), 'utf8'), /garden:place/);
});

test('soil temperature map: projection, bulk feeds, colour bands and page section', () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/national-tools/planting/_data/us-map.json'), 'utf8'));
  assert.match(m.source, /Census/); assert.ok(m.outline.length > 1000 && m.borders.length > 1000);
  // Corners of the lower 48 land inside the frame, in the right order.
  const [sx, sy] = S.project(47.6, -122.3, m), [mx, my] = S.project(25.8, -80.2, m), [bx, by] = S.project(44.8, -68.8, m), [kx, ky] = S.project(37.7, -97.3, m);
  for (const [x, y] of [[sx, sy], [mx, my], [bx, by], [kx, ky]]) assert.ok(x > 0 && x < m.W && y > 0 && y < m.H);
  assert.ok(sx < kx && kx < mx && kx < bx && sy < ky && ky < my);
  const awdb = [{ stationTriplet: '1:KS:SCAN', data: [{ values: [{ date: '2026-10-23', value: 60 }, { date: '2026-10-24', value: null }] }] }, { stationTriplet: '2:KS:SCAN', data: [] }];
  assert.deepEqual([...S.latestAWDB(awdb)], [['1:KS:SCAN', { iso: '2026-10-23', t: 60 }]]);
  const day = S.fromCRNDay('53182 20261024  2.622  -102.81   31.62    15.0    -1.5     6.8     6.2     0.0    12.52 C    18.6    -3.6     4.9    87.4    24.9    57.3   0.207   0.204   0.190   0.072   0.330    22.9     9.0     9.0    10.5    11.3');
  assert.deepEqual(day.get('53182'), { iso: '2026-10-24', t: 73.2, lat: 31.62, lon: -102.81 });
  assert.equal(S.band(34.9).label, 'Below 35°F'); assert.equal(S.band(35).label, '35 to 39°F'); assert.equal(S.band(60).label, '60 to 69°F'); assert.equal(S.band(70).label, '70°F and up');
  for (const c of Object.values(G.seeds)) assert.ok(S.BANDS.some(b => b.max === c.minimum), c.name + ' minimum is a band edge');
  assert.match(PAGE, /<h2 id="sm-head">Soil temperature map<\/h2>/);
  assert.match(PAGE, /id="sm-status" role="status"/);
  assert.match(PAGE, /<svg id="sm-map" role="img" aria-labelledby="sm-head sm-status">/);
  assert.match(PAGE, /<tbody id="sm-rows">/, 'a list alternative to the map');
  assert.match(PAGE, /soil-map-page\.js/);
});
