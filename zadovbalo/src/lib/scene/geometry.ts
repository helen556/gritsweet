export type Pt = { x: number; y: number };

export function roundedRect(w: number, h: number, r: number, seg = 6): Pt[] {
  const pts: Pt[] = [];
  const corners: [number, number, number][] = [
    [w / 2 - r, -h / 2 + r, -Math.PI / 2],
    [w / 2 - r, h / 2 - r, 0],
    [-w / 2 + r, h / 2 - r, Math.PI / 2],
    [-w / 2 + r, -h / 2 + r, Math.PI],
  ];
  for (const [cx, cy, a0] of corners)
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  return pts;
}

export function area(poly: Pt[]) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

/** Залишає частину полігона, де (p − m)·n ≥ 0 (Sutherland–Hodgman для однієї площини). */
export function clipHalfPlane(poly: Pt[], m: Pt, n: Pt): Pt[] {
  const out: Pt[] = [];
  const side = (p: Pt) => (p.x - m.x) * n.x + (p.y - m.y) * n.y;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const sa = side(a);
    const sb = side(b);
    if (sa >= 0) out.push(a);
    if (sa >= 0 !== sb >= 0) {
      const t = sa / (sa - sb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

export function reflect(p: Pt, m: Pt, n: Pt): Pt {
  const d = (p.x - m.x) * n.x + (p.y - m.y) * n.y;
  return { x: p.x - 2 * d * n.x, y: p.y - 2 * d * n.y };
}

/**
 * Відклеювання за точкою захоплення A, яку тягнуть у P (усе в локальних координатах наліпки).
 * Лінія згину — серединний перпендикуляр AP. Частина з боку A відгортається й віддзеркалюється.
 */
export function peel(poly: Pt[], a: Pt, p: Pt) {
  const dx = p.x - a.x;
  const dy = p.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return { stuck: poly, flap: [] as Pt[], fold: null, peeledFraction: 0 };
  const n = { x: dx / len, y: dy / len };
  const m = { x: (a.x + p.x) / 2, y: (a.y + p.y) / 2 };
  const stuck = clipHalfPlane(poly, m, n);
  const peeled = clipHalfPlane(poly, m, { x: -n.x, y: -n.y });
  const flap = peeled.map((q) => reflect(q, m, n));
  return { stuck, flap, fold: { m, n }, peeledFraction: area(peeled) / area(poly) };
}

/** Комірки Вороного всередині полігона (для уламків). O(n²), для n ≤ ~30. */
export function voronoiCells(poly: Pt[], seeds: Pt[]): Pt[][] {
  return seeds.map((si, i) => {
    let cell = poly;
    for (let j = 0; j < seeds.length && cell.length >= 3; j++) {
      if (i === j) continue;
      const sj = seeds[j]!;
      const dx = si.x - sj.x;
      const dy = si.y - sj.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      cell = clipHalfPlane(cell, { x: (si.x + sj.x) / 2, y: (si.y + sj.y) / 2 }, { x: dx / len, y: dy / len });
    }
    return cell;
  });
}
