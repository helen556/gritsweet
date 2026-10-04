/**
 * Злами для посуду. Усе в координатах спрайта (px).
 * Кераміка: радіальні тріщини від точки удару + кільцеві → клиноподібні нерівні шматки, як у справжньої тарілки.
 * Скло: шматки за силуетом пляшки (профіль з альфа-каналу), горлечко й дно часто лишаються більшими.
 */
export type Pt = [number, number];

export interface ShardShape {
  /** Вершини відносно центроїда (px спрайта). */
  poly: Pt[];
  /** Центроїд у координатах спрайта. */
  c: Pt;
  /** Площа (px²) — для маси й звуку. */
  area: number;
}

function rnd(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function centroid(poly: Pt[]): { c: Pt; area: number } {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i]!;
    const [x1, y1] = poly[(i + 1) % poly.length]!;
    const k = x0 * y1 - x1 * y0;
    a += k;
    cx += (x0 + x1) * k;
    cy += (y0 + y1) * k;
  }
  a /= 2;
  if (Math.abs(a) < 1e-6) {
    const mx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
    const my = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    return { c: [mx, my], area: 0 };
  }
  return { c: [cx / (6 * a), cy / (6 * a)], area: Math.abs(a) };
}

function toShape(poly: Pt[]): ShardShape | null {
  const { c, area } = centroid(poly);
  if (area < 6) return null;
  return { poly: poly.map(([x, y]) => [x - c[0], y - c[1]] as Pt), c, area };
}

/** Тарілка: центр (cx, cy), радіуси (rx, ry), точка удару (ix, iy). */
export function fracturePlate(cx: number, cy: number, rx: number, ry: number, ix: number, iy: number, seed: number): ShardShape[] {
  const r = rnd(seed);
  const n = 8 + Math.floor(r() * 4);
  const angles: number[] = [];
  for (let k = 0; k < n; k++) angles.push(((k + 0.25 + r() * 0.5) / n) * Math.PI * 2);
  const rings = [0.24 + r() * 0.1, 0.56 + r() * 0.12, 1];
  // зубчасті кільцеві тріщини — спільні для сусідніх шматків
  const ringJit = rings.map(() => Array.from({ length: 64 }, () => (r() - 0.5) * 0.06));
  const rimR = (a: number) => (rx * ry) / Math.hypot(ry * Math.cos(a), rx * Math.sin(a));
  const ring = (j: number, a: number): Pt => {
    if (j === rings.length - 1) {
      // край тарілки — справжній обідок (ортогонально від центру тарілки)
      const R = rimR(a);
      return [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
    }
    const idx = Math.floor((((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 64);
    const R = rimR(a) * rings[j]! * (1 + ringJit[j]![idx]!);
    return [ix + Math.cos(a) * R, iy + Math.sin(a) * R];
  };
  const arc = (j: number, a0: number, a1: number): Pt[] => {
    const steps = Math.max(2, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 40));
    const out: Pt[] = [];
    for (let i = 0; i <= steps; i++) out.push(ring(j, a0 + ((a1 - a0) * i) / steps));
    return out;
  };
  const shapes: ShardShape[] = [];
  // серцевина — 2–3 шматки
  const coreSplits = 2 + Math.floor(r() * 2);
  for (let s = 0; s < coreSplits; s++) {
    const k0 = Math.floor((s * n) / coreSplits);
    const k1 = Math.floor(((s + 1) * n) / coreSplits);
    const a0 = angles[k0]!;
    const a1 = k1 >= n ? angles[0]! + Math.PI * 2 : angles[k1]!;
    const poly: Pt[] = [[ix + (r() - 0.5) * 6, iy + (r() - 0.5) * 6], ...arc(0, a0, a1)];
    const sh = toShape(poly);
    if (sh) shapes.push(sh);
  }
  for (let j = 1; j < rings.length; j++) {
    for (let k = 0; k < n; k++) {
      // іноді два сусідні сектори лишаються одним шматком — розміри різні
      const merge = j === rings.length - 1 && r() < 0.3 ? 2 : 1;
      if (merge === 2 && k === n - 1) continue;
      const a0 = angles[k]!;
      const kk = k + merge;
      const a1 = kk >= n ? angles[kk - n]! + Math.PI * 2 : angles[kk]!;
      const inner = arc(j - 1, a0, a1);
      const outer = arc(j, a0, a1).reverse();
      const poly: Pt[] = [...inner, ...outer];
      // ще один поперечний злам у великих шматках зовнішнього кільця
      if (j === rings.length - 1 && merge === 1 && r() < 0.45) {
        const mid = (a0 + a1) / 2 + (r() - 0.5) * 0.2;
        const pa = [...arc(j - 1, a0, mid), ...arc(j, a0, mid).reverse()];
        const pb = [...arc(j - 1, mid, a1), ...arc(j, mid, a1).reverse()];
        for (const p of [pa, pb]) {
          const sh = toShape(p);
          if (sh) shapes.push(sh);
        }
        k += merge - 1;
        continue;
      }
      const sh = toShape(poly);
      if (sh) shapes.push(sh);
      k += merge - 1;
    }
  }
  // дрібні відколи з краю
  const chips = 10 + Math.floor(r() * 8);
  for (let i = 0; i < chips; i++) {
    const a = r() * Math.PI * 2;
    const [px, py] = ring(rings.length - 1, a);
    const s = 3 + r() * 7;
    const b = r() * Math.PI;
    const poly: Pt[] = [
      [px + Math.cos(b) * s, py + Math.sin(b) * s],
      [px + Math.cos(b + 2.1 + r()) * s, py + Math.sin(b + 2.1 + r()) * s],
      [px + Math.cos(b + 4.1 + r() * 0.8) * s * 0.7, py + Math.sin(b + 4.1 + r() * 0.8) * s * 0.7],
    ];
    const sh = toShape(poly);
    if (sh) shapes.push(sh);
  }
  return shapes;
}

/**
 * Пляшка: профіль ширини вздовж осі (з альфа-каналу). Сітка злам — нерівні чотирикутники й трикутники в межах силуету;
 * дно й горлечко — більші шматки.
 */
export function fractureBottle(
  axis: [Pt, Pt],
  profile: { u: number; v0: number; v1: number }[],
  seed: number,
): ShardShape[] {
  const r = rnd(seed);
  const [a, b] = axis;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / L;
  const uy = (b[1] - a[1]) / L;
  const vx = -uy;
  const vy = ux;
  const at = (u: number, v: number): Pt => [a[0] + ux * u * L + vx * v, a[1] + uy * u * L + vy * v];
  const prof = (u: number) => {
    let best = profile[0]!;
    for (const p of profile) if (Math.abs(p.u - u) < Math.abs(best.u - u)) best = p;
    return best;
  };
  // межі по довжині: горлечко (0..~0.3) — 1–2 шматки, корпус — сітка, дно (~0.85..1) — один шматок
  const cuts = [0, 0.18 + r() * 0.08, 0.32 + r() * 0.05];
  let u = cuts[cuts.length - 1]!;
  while (u < 0.8) {
    u += 0.075 + r() * 0.07;
    cuts.push(Math.min(u, 0.84 + r() * 0.04));
  }
  cuts.push(1.01);
  const shapes: ShardShape[] = [];
  const cols = (i: number) => (i < 2 ? 1 : 2 + Math.floor(r() * 2));
  // поперечні лінії злому з нахилом і зубцями — спільні для сусідів
  const lineJit = cuts.map(() => [(r() - 0.5) * 0.05, (r() - 0.5) * 0.05, (r() - 0.5) * 0.05]);
  const edge = (i: number, t: number) => {
    const j = lineJit[i]!;
    return cuts[i]! + j[0]! * (1 - t) + j[2]! * t + j[1]! * Math.sin(t * Math.PI);
  };
  for (let i = 0; i < cuts.length - 1; i++) {
    const c = cols(i);
    const isBase = i === cuts.length - 2;
    const splits = isBase ? 1 : c;
    const ts = [0];
    for (let s = 1; s < splits; s++) ts.push(s / splits + (r() - 0.5) * 0.18);
    ts.push(1);
    for (let s = 0; s < splits; s++) {
      const poly: Pt[] = [];
      const t0 = ts[s]!;
      const t1 = ts[s + 1]!;
      const N = 4;
      const P = (uu: number, t: number): Pt => {
        const p = prof(Math.max(0, Math.min(1, uu)));
        return at(uu, p.v0 + (p.v1 - p.v0) * t);
      };
      for (let k = 0; k <= N; k++) {
        const t = t0 + ((t1 - t0) * k) / N;
        poly.push(P(edge(i, t), t));
      }
      // бічна лінія злому вздовж осі
      poly.push(P((edge(i, t1) + edge(i + 1, t1)) / 2 + (r() - 0.5) * 0.02, t1 + (r() - 0.5) * 0.05));
      for (let k = N; k >= 0; k--) {
        const t = t0 + ((t1 - t0) * k) / N;
        poly.push(P(Math.min(1, edge(i + 1, t)), t));
      }
      poly.push(P((edge(i, t0) + edge(i + 1, t0)) / 2 + (r() - 0.5) * 0.02, t0 + (r() - 0.5) * 0.05));
      // великі шматки корпусу іноді розколюються по діагоналі
      if (!isBase && i > 1 && poly.length > 8 && r() < 0.5) {
        const half = Math.floor(poly.length / 2);
        const pa = poly.slice(0, half + 1);
        const pb = [...poly.slice(half), poly[0]!];
        for (const p of [pa, pb]) {
          const sh = toShape(p);
          if (sh) shapes.push(sh);
        }
        continue;
      }
      const sh = toShape(poly);
      if (sh) shapes.push(sh);
    }
  }
  // дрібні скалки
  const slivers = 14 + Math.floor(r() * 10);
  for (let i = 0; i < slivers; i++) {
    const uu = 0.25 + r() * 0.6;
    const p = prof(uu);
    const [px, py] = at(uu, p.v0 + (p.v1 - p.v0) * r());
    const s = 2 + r() * 6;
    const ang = r() * Math.PI;
    const poly: Pt[] = [
      [px + Math.cos(ang) * s * 1.8, py + Math.sin(ang) * s * 1.8],
      [px + Math.cos(ang + 2.6) * s * 0.6, py + Math.sin(ang + 2.6) * s * 0.6],
      [px + Math.cos(ang + 3.7) * s * 0.7, py + Math.sin(ang + 3.7) * s * 0.7],
    ];
    const sh = toShape(poly);
    if (sh) shapes.push(sh);
  }
  return shapes;
}
