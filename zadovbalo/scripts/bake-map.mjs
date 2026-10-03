// Генерує src/lib/scenes/russia-outline.ts: node scripts/bake-map.mjs src/lib/scenes/russia-outline.ts
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve("world-atlas/countries-50m.json"), "utf8"));
const fc = feature(topo, topo.objects.countries);
const ru = fc.features.find((f) => f.properties.name === "Russia");
const inRing = (p, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
// Крим — Україна. Прибираємо будь-який полігон, що лежить у межах півострова.
const crimea = [[33.52, 44.6], [34.1, 44.95], [36.47, 45.35], [33.4, 45.2], [35.4, 45.0]];
let polys = ru.geometry.coordinates.filter((poly) => !crimea.some((p) => inRing(p, poly[0])));
console.error("removed polygons:", ru.geometry.coordinates.length - polys.length);
// Чукотка: довготи < 0 → +360, щоб контур не розривався.
polys = polys.map((poly) => poly.map((ring) => ring.map(([lon, lat]) => [lon < 0 ? lon + 360 : lon, lat])));
// Конічна рівнокутна проєкція Ламберта (стандартні паралелі 52° і 68°, центр 100° сх. д.).
const rad = Math.PI / 180, p1 = 52 * rad, p2 = 68 * rad, p0 = 60 * rad, l0 = 100 * rad;
const n = Math.log(Math.cos(p1) / Math.cos(p2)) / Math.log(Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2));
const F = (Math.cos(p1) * Math.pow(Math.tan(Math.PI / 4 + p1 / 2), n)) / n;
const rho = (phi) => F / Math.pow(Math.tan(Math.PI / 4 + phi / 2), n);
const r0 = rho(p0);
const proj = ([lon, lat]) => { const r = rho(lat * rad); const t = n * (lon * rad - l0); return [r * Math.sin(t), -(r0 - r * Math.cos(t))]; };
let rings = polys.map((poly) => poly[0].map(proj)); // лише зовнішні контури
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const r of rings) for (const [x, y] of r) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
const W = 1000, scale = W / (maxX - minX), H = Math.round((maxY - minY) * scale);
rings = rings.map((r) => r.map(([x, y]) => [(x - minX) * scale, (y - minY) * scale]));
// Дуглас — Пекер.
const dp = (pts, eps) => { if (pts.length < 3) return pts; let dmax = 0, idx = 0; const [a, b] = [pts[0], pts[pts.length - 1]]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9; for (let i = 1; i < pts.length - 1; i++) { const p = pts[i]; const d = Math.abs((b[1] - a[1]) * p[0] - (b[0] - a[0]) * p[1] + b[0] * a[1] - b[1] * a[0]) / L; if (d > dmax) { dmax = d; idx = i; } } if (dmax > eps) { const l = dp(pts.slice(0, idx + 1), eps); return [...l.slice(0, -1), ...dp(pts.slice(idx), eps)]; } return [a, b]; };
const area = (r) => Math.abs(r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
rings = rings.filter((r) => area(r) > 25);
// Замкнений контур: ділимо в найвіддаленішій від першої точці й спрощуємо половини окремо.
const dpRing = (r, eps) => { let k = 0, best = 0; for (let i = 1; i < r.length; i++) { const d = Math.hypot(r[i][0] - r[0][0], r[i][1] - r[0][1]); if (d > best) { best = d; k = i; } } const a = dp(r.slice(0, k + 1), eps); const b = dp(r.slice(k), eps); return [...a.slice(0, -1), ...b.slice(0, -1)]; };
rings = rings.map((r) => dpRing(r, 0.9));
rings = rings.filter((r) => r.length >= 4);
const flat = rings.map((r) => r.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]).flat());
const out = `/**
 * Символічний контур рф (Natural Earth 1:50m через пакет world-atlas, public domain).
 * Крим вилучено — це Україна. Конічна проєкція Ламберта, спрощено. Згенеровано скриптом bake (не редагувати вручну).
 */
export const RUSSIA_VIEW = { w: ${W}, h: ${H} } as const;
export const RUSSIA_RINGS: readonly (readonly number[])[] = ${JSON.stringify(flat)};
`;
writeFileSync(process.argv[2], out);
console.error("rings:", flat.length, "points:", flat.reduce((s, r) => s + r.length / 2, 0), "bytes:", out.length, "H:", H);
// Перевірка: жодна точка Криму не всередині.
const ok = !polys.some((poly) => crimea.some((p) => inRing(p, poly[0])));
console.error("crimea excluded:", ok);
// Перевірка: міста тимчасово окупованих територій України — не в контурі (лише міжнародно визнані межі).
const occupied = {
  Sevastopol: [33.52, 44.6], Simferopol: [34.1, 44.95], Kerch: [36.47, 45.35],
  Donetsk: [37.8, 48.0], Luhansk: [39.31, 48.57], Mariupol: [37.55, 47.1], Melitopol: [35.37, 46.85],
  Berdiansk: [36.79, 46.76], NovaKakhovka: [33.37, 46.75], Henichesk: [34.82, 46.17], Sievierodonetsk: [38.49, 48.95],
};
const inside = Object.entries(occupied).filter(([, p]) => polys.some((poly) => inRing(p, poly[0])));
console.error("occupied Ukrainian points inside outline:", inside.length ? inside.map(([n]) => n).join(", ") : "none");
// А російські міста — всередині (контур не зламаний).
const control = { Moscow: [37.62, 55.75], Rostov: [39.7, 47.23], Kaliningrad: [20.5, 54.71], Vladivostok: [131.9, 43.12] };
const missing = Object.entries(control).filter(([, p]) => !polys.some((poly) => inRing(p, poly[0])));
console.error("control points missing:", missing.length ? missing.map(([n]) => n).join(", ") : "none");
if (!ok || inside.length || missing.length) process.exit(1);
