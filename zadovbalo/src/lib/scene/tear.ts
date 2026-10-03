import { area, type Pt } from "./geometry";

/** Перетин відрізків ab і cd: параметр t на ab або null. */
function segHit(a: Pt, b: Pt, c: Pt, d: Pt): { t: number; u: number } | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { t, u } : null;
}

export function pointInPoly(p: Pt, poly: Pt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export interface Crossing {
  /** Індекс ребра полігона (poly[edge] → poly[edge+1]). */
  edge: number;
  /** Параметр уздовж ребра. */
  t: number;
  point: Pt;
  /** Індекс сегмента шляху, на якому сталося перетинання. */
  seg: number;
}

/** Усі перетини ламаної з межею полігона, по порядку вздовж ламаної. */
export function crossings(poly: Pt[], path: Pt[]): Crossing[] {
  const out: (Crossing & { order: number })[] = [];
  for (let s = 0; s < path.length - 1; s++) {
    const a = path[s]!;
    const b = path[s + 1]!;
    for (let e = 0; e < poly.length; e++) {
      const c = poly[e]!;
      const d = poly[(e + 1) % poly.length]!;
      const hit = segHit(a, b, c, d);
      if (hit) out.push({ edge: e, t: hit.u, point: { x: a.x + (b.x - a.x) * hit.t, y: a.y + (b.y - a.y) * hit.t }, seg: s, order: s + hit.t });
    }
  }
  return out.sort((x, y) => x.order - y.order);
}

/**
 * Розрив полігона ламаною, що входить через край і виходить через інший край.
 * Повертає два шматки, чиї нові краї повторюють рух пальця.
 */
export function splitByPath(poly: Pt[], path: Pt[]): [Pt[], Pt[]] | null {
  const xs = crossings(poly, path);
  if (xs.length < 2) return null;
  const enter = xs[0]!;
  const exit = xs[1]!;
  const inner = [enter.point, ...path.slice(enter.seg + 1, exit.seg + 1), exit.point];
  if (inner.length < 2) return null;
  const n = poly.length;
  // Ланцюг межі від точки виходу до точки входу (вперед по вершинах).
  const chain = (from: Crossing, to: Crossing): Pt[] => {
    const pts: Pt[] = [from.point];
    let i = (from.edge + 1) % n;
    let guard = 0;
    if (from.edge === to.edge && to.t > from.t) return [from.point, to.point];
    while (guard++ <= n) {
      pts.push(poly[i]!);
      if (i === to.edge) break;
      i = (i + 1) % n;
    }
    pts.push(to.point);
    return pts;
  };
  const a = [...chain(exit, enter).slice(0, -1), ...inner];
  const b = [...chain(enter, exit).slice(0, -1), ...[...inner].reverse()];
  const total = area(poly);
  if (area(a) < total * 0.01 || area(b) < total * 0.01) return null;
  return [a, b];
}

/** Нерівний край розриву: дрібні нерегулярні зубці + повільне «блукання» лінії. */
export function jagged(path: Pt[], amp: number, seed: number): Pt[] {
  const rnd = (i: number) => {
    const v = Math.sin((i + seed * 31.7) * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  };
  const out: Pt[] = [];
  let n = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.round(len / 2.5));
    const nx = -(b.y - a.y) / (len || 1);
    const ny = (b.x - a.x) / (len || 1);
    for (let k = 0; k < steps; k++, n++) {
      const t = k / steps;
      // дрібні волоконця (часті) + повільна хвиля (рідка)
      const fine = (rnd(n) - 0.5) * amp * (rnd(n + 999) > 0.8 ? 1.8 : 0.9);
      const wander = Math.sin(n * 0.11 + seed) * amp * 0.6;
      out.push({ x: a.x + (b.x - a.x) * t + nx * (fine + wander), y: a.y + (b.y - a.y) * t + ny * (fine + wander) });
    }
  }
  out.push(path[path.length - 1]!);
  return out;
}

export function centroid(poly: Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}
