#!/usr/bin/env node
/**
 * Builds public/national-tools/planting/_data/us-map.json, the lower-48 outline the soil temperature
 * map draws. Run by hand, rarely; the boundary package is not a dependency of this repo:
 *
 *   npm i --no-save us-atlas@3 topojson-client@3 && node scripts/build-us-map.mjs
 *
 * Boundaries: U.S. Census Bureau cartographic boundaries via us-atlas 3.0.1 (ISC), states-10m.
 * Projection: Albers equal-area conic (standard parallels 29.5 and 45.5, origin 37.5N 96W), the same
 * one SoilStation.project() uses for station points, scaled to a 960 x 600 frame.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const topojson = require('topojson-client');
const topo = require('us-atlas/states-10m.json');
const NOT = new Set(['02', '15', '60', '66', '69', '72', '78']);
const conus = f => !NOT.has(String(f.id).padStart(2, '0'));
const r = Math.PI / 180, p1 = 29.5 * r, p2 = 45.5 * r, p0 = 37.5 * r, l0 = -96 * r;
const n = (Math.sin(p1) + Math.sin(p2)) / 2, C = Math.cos(p1) ** 2 + 2 * n * Math.sin(p1), rho0 = Math.sqrt(C - 2 * n * Math.sin(p0)) / n;
const raw = ([lon, lat]) => { const rho = Math.sqrt(C - 2 * n * Math.sin(lat * r)) / n, th = n * (lon * r - l0); return [rho * Math.sin(th), rho0 - rho * Math.cos(th)]; };
const interior = topojson.mesh(topo, topo.objects.states, (a, b) => a !== b && conus(a) && conus(b));
const exterior = topojson.mesh(topo, topo.objects.states, (a, b) => a === b && conus(a));
const xs = [], ys = [];
for (const line of exterior.coordinates) for (const p of line) { const [x, y] = raw(p); xs.push(x); ys.push(y); }
const W = 960, H = 600, pad = 10, minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
const k = Math.min((W - 2 * pad) / (maxX - minX), (H - 2 * pad) / (maxY - minY));
const tx = pad - minX * k + ((W - 2 * pad) - (maxX - minX) * k) / 2, ty = pad + maxY * k + ((H - 2 * pad) - (maxY - minY) * k) / 2;
const proj = p => { const [x, y] = raw(p); return [x * k + tx, ty - y * k]; };
const draw = mls => mls.coordinates.map(line => { const out = []; let last = null; line.forEach((p, i) => { const q = proj(p); if (last && i < line.length - 1 && Math.hypot(q[0] - last[0], q[1] - last[1]) < 1.6) return; out.push(q); last = q; }); return out.length > 1 ? 'M' + out.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L') : ''; }).join('');
const out = { source: 'U.S. Census Bureau cartographic boundaries via us-atlas 3.0.1 (ISC), states-10m, lower 48, Albers equal-area (29.5/45.5, origin 37.5N 96W)', W, H, k, tx, ty, outline: draw(exterior), borders: draw(interior) };
fs.writeFileSync(path.join(root, 'public/national-tools/planting/_data/us-map.json'), JSON.stringify(out));
console.log('wrote us-map.json', JSON.stringify(out).length, 'bytes');
