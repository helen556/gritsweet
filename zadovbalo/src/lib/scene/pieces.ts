import { hash2 } from "@/lib/scene/heightfield";
import type { Pt } from "@/lib/scene/geometry";
import { centroid, jagged, pointInPoly, splitByPath } from "@/lib/scene/tear";

/** Шматок аркуша. Полігон і край розриву — у системі координат вихідного аркуша. */
export interface Piece {
  id: number;
  poly: Pt[];
  torn: Pt[][];
  c: Pt;
  x: number;
  y: number;
  rot: number;
  vx: number;
  vy: number;
  vr: number;
  crumple: number;
  held: boolean;
  /** Обриси кульки, щоб змʼятий шматок мав стабільну форму. */
  ballSeed: number;
}

let nextId = 1;
export function makePiece(poly: Pt[], torn: Pt[][] = [], base?: Partial<Piece>): Piece {
  return { id: nextId++, poly, torn, c: centroid(poly), x: 0, y: 0, rot: 0, vx: 0, vy: 0, vr: 0, crumple: 0, held: false, ballSeed: Math.random() * 100, ...base };
}

/** Світ ← локальні координати шматка. */
export function toWorld(p: Piece, q: Pt): Pt {
  const c = Math.cos(p.rot);
  const s = Math.sin(p.rot);
  const dx = q.x - p.c.x;
  const dy = q.y - p.c.y;
  return { x: p.c.x + p.x + dx * c - dy * s, y: p.c.y + p.y + dx * s + dy * c };
}
export function toLocal(p: Piece, q: Pt): Pt {
  const c = Math.cos(-p.rot);
  const s = Math.sin(-p.rot);
  const dx = q.x - p.c.x - p.x;
  const dy = q.y - p.c.y - p.y;
  return { x: p.c.x + dx * c - dy * s, y: p.c.y + dx * s + dy * c };
}

export function hitPiece(pieces: Piece[], w: Pt): Piece | null {
  for (let i = pieces.length - 1; i >= 0; i--) {
    const p = pieces[i]!;
    const local = toLocal(p, w);
    if (p.crumple > 0.5) {
      const r = ballRadius(p);
      if (Math.hypot(local.x - p.c.x, local.y - p.c.y) < r * 1.2) return p;
    } else if (pointInPoly(local, p.poly)) return p;
  }
  return null;
}

export function ballRadius(p: Piece) {
  let a = 0;
  for (let i = 0; i < p.poly.length; i++) {
    const u = p.poly[i]!;
    const v = p.poly[(i + 1) % p.poly.length]!;
    a += u.x * v.y - v.x * u.y;
  }
  return Math.sqrt(Math.abs(a) / 2 / Math.PI) * 0.55;
}

/** Розірвати шматок ламаною (у світових координатах). Нові краї — нерівні, повторюють рух. */
export function tearPiece(p: Piece, worldPath: Pt[], amp: number): [Piece, Piece] | null {
  const local = worldPath.map((q) => toLocal(p, q));
  const rough = jagged(local, amp, p.id);
  const res = splitByPath(p.poly, rough);
  if (!res) return null;
  const edge = rough.filter((q) => pointInPoly(q, p.poly));
  const [a, b] = res;
  const base = { x: p.x, y: p.y, rot: p.rot, crumple: p.crumple };
  // Кожному шматку — лише ті ділянки старих розривів, що лежать на його межі.
  const pa = makePiece(a, keepOnBoundary([...p.torn, edge], a), base);
  const pb = makePiece(b, keepOnBoundary([...p.torn, edge], b), base);
  // Центри змінились — перераховуємо зсув, щоб шматки лишились на місці.
  for (const q of [pa, pb]) {
    const want = toWorld(p, q.c);
    q.x = want.x - q.c.x;
    q.y = want.y - q.c.y;
  }
  // Легенько розходяться в різні боки від лінії розриву.
  const ca = toWorld(pa, pa.c);
  const cb = toWorld(pb, pb.c);
  const dx = ca.x - cb.x;
  const dy = ca.y - cb.y;
  const len = Math.hypot(dx, dy) || 1;
  pa.vx = (dx / len) * 70;
  pa.vy = (dy / len) * 70;
  pb.vx = (-dx / len) * 70;
  pb.vy = (-dy / len) * 70;
  pa.vr = 0.18;
  pb.vr = -0.18;
  return [pa, pb];
}

function distToPoly(q: Pt, poly: Pt[]) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const L = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((q.x - a.x) * (b.x - a.x) + (q.y - a.y) * (b.y - a.y)) / L));
    best = Math.min(best, Math.hypot(q.x - (a.x + (b.x - a.x) * t), q.y - (a.y + (b.y - a.y) * t)));
  }
  return best;
}

/** Розбиває краї на суцільні ділянки, що лежать на межі полігона (±3 px). */
function keepOnBoundary(edges: Pt[][], poly: Pt[]): Pt[][] {
  const out: Pt[][] = [];
  for (const e of edges) {
    let run: Pt[] = [];
    for (const q of e) {
      if (distToPoly(q, poly) <= 3) run.push(q);
      else {
        if (run.length > 1) out.push(run);
        run = [];
      }
    }
    if (run.length > 1) out.push(run);
  }
  return out;
}

/** Фізика вільних шматків: інерція з тертям об стіл. */
export function stepPieces(pieces: Piece[], dt: number) {
  let moving = false;
  for (const p of pieces) {
    if (p.held) continue;
    if (Math.abs(p.vx) + Math.abs(p.vy) + Math.abs(p.vr) * 50 < 1) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    const f = Math.pow(0.02, dt);
    p.vx *= f;
    p.vy *= f;
    p.vr *= f;
    moving = true;
  }
  return moving;
}

let grain: CanvasPattern | null = null;
function paperGrain(ctx: CanvasRenderingContext2D) {
  if (grain) return grain;
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const g = c.getContext("2d")!;
  const img = g.createImageData(96, 96);
  for (let i = 0; i < 96 * 96; i++) {
    const x = i % 96;
    const y = (i / 96) | 0;
    const n = hash2(x, y) * 0.6 + hash2(x * 0.3 + 7, y * 2.1) * 0.4;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 120 + n * 60;
    img.data[i * 4 + 3] = 18;
  }
  g.putImageData(img, 0, 0);
  grain = ctx.createPattern(c, "repeat");
  return grain;
}

function trace(ctx: CanvasRenderingContext2D, poly: Pt[]) {
  ctx.beginPath();
  poly.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
}

/** Форма шматка з урахуванням змʼятості: точки стягуються до нерівного кола. */
function shapeOf(p: Piece): Pt[] {
  if (p.crumple <= 0) return p.poly;
  const R = ballRadius(p);
  const t = p.crumple;
  return p.poly.map((q, i) => {
    const a = Math.atan2(q.y - p.c.y, q.x - p.c.x);
    const rr = R * (0.8 + 0.35 * hash2(p.ballSeed, Math.floor((a + Math.PI) * 2.2)));
    const tx = p.c.x + Math.cos(a) * rr;
    const ty = p.c.y + Math.sin(a) * rr;
    const wob = Math.sin(i * 2.3 + p.ballSeed) * 3 * t;
    return { x: q.x + (tx - q.x) * t + wob, y: q.y + (ty - q.y) * t + wob };
  });
}

export interface DrawOptions {
  base: string;
  /** Малює вміст аркуша (у координатах аркуша), напр. карту. */
  paint?: (ctx: CanvasRenderingContext2D) => void;
  lift?: (p: Piece) => number;
}

export function drawPiece(ctx: CanvasRenderingContext2D, p: Piece, o: DrawOptions) {
  const shape = shapeOf(p);
  const lift = o.lift?.(p) ?? (p.held ? 14 : 3);
  ctx.save();
  ctx.translate(p.c.x + p.x, p.c.y + p.y);
  ctx.rotate(p.rot);
  ctx.translate(-p.c.x, -p.c.y);
  // Контактна тінь.
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 6 + lift * 1.4;
  ctx.shadowOffsetY = 2 + lift * 0.7;
  ctx.fillStyle = o.base;
  trace(ctx, shape);
  ctx.fill();
  ctx.restore();

  ctx.save();
  trace(ctx, shape);
  ctx.clip();
  const pattern = paperGrain(ctx);
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(p.c.x - 600, p.c.y - 600, 1200, 1200);
  }
  // Освітлення аркуша: світло зліва згори, легкий спад до краю.
  const light = ctx.createLinearGradient(p.c.x - 260, p.c.y - 320, p.c.x + 260, p.c.y + 320);
  light.addColorStop(0, "rgba(255,255,255,0.18)");
  light.addColorStop(0.55, "rgba(255,255,255,0)");
  light.addColorStop(1, "rgba(40,55,65,0.16)");
  ctx.fillStyle = light;
  ctx.fillRect(p.c.x - 600, p.c.y - 600, 1200, 1200);
  if (p.crumple < 0.7) {
    ctx.save();
    if (p.crumple > 0) {
      // Вміст «зʼїжджає» разом зі стисканням.
      ctx.translate(p.c.x, p.c.y);
      const k = 1 - p.crumple * 0.55;
      ctx.scale(k, k);
      ctx.translate(-p.c.x, -p.c.y);
      ctx.globalAlpha = 1 - p.crumple / 0.7;
    }
    o.paint?.(ctx);
    ctx.restore();
  }
  // Заломи: світла й темна лінія поруч — обʼєм складки.
  if (p.crumple > 0) {
    const R = Math.max(40, ballRadius(p) * 2.2);
    for (let i = 0; i < 22; i++) {
      const a = hash2(p.ballSeed, i) * Math.PI * 2;
      const len = R * (0.3 + hash2(p.ballSeed, i + 50) * 0.9);
      const ox = p.c.x + (hash2(p.ballSeed, i + 90) - 0.5) * R * 1.2;
      const oy = p.c.y + (hash2(p.ballSeed, i + 130) - 0.5) * R * 1.2;
      const vis = Math.min(1, p.crumple * 2.2 - (i / 22) * 0.9);
      if (vis <= 0) continue;
      const dx = Math.cos(a) * len * 0.5;
      const dy = Math.sin(a) * len * 0.5;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * vis})`;
      ctx.beginPath();
      ctx.moveTo(ox - dx, oy - dy);
      ctx.lineTo(ox + dx, oy + dy);
      ctx.stroke();
      ctx.strokeStyle = `rgba(30,40,46,${0.38 * vis})`;
      ctx.beginPath();
      ctx.moveTo(ox - dx + 1.6, oy - dy + 1.6);
      ctx.lineTo(ox + dx + 1.6, oy + dy + 1.6);
      ctx.stroke();
    }
    // Загальне затінення кульки.
    const g = ctx.createRadialGradient(p.c.x - 20, p.c.y - 24, 4, p.c.x, p.c.y, ballRadius(p) * 1.6 + 60 * (1 - p.crumple));
    g.addColorStop(0, "rgba(255,255,255,0.0)");
    g.addColorStop(1, `rgba(10,18,24,${0.45 * p.crumple})`);
    ctx.fillStyle = g;
    ctx.fillRect(p.c.x - 600, p.c.y - 600, 1200, 1200);
  }
  ctx.restore();

  // Край розриву: світліші волокна.
  if (p.crumple < 0.5)
    for (const edge of p.torn) {
      ctx.save();
      trace(ctx, shape);
      ctx.clip();
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      edge.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.stroke();
      ctx.restore();
      drawFibers(ctx, edge, p.id);
    }
  ctx.restore();
}

/** Волокна, що стирчать із краю розриву. */
export function drawFibers(ctx: CanvasRenderingContext2D, edge: Pt[], seed: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(240,242,240,0.7)";
  ctx.lineWidth = 0.7;
  for (let i = 1; i < edge.length; i += 2) {
    const a = edge[i - 1]!;
    const b = edge[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const side = hash2(seed, i) > 0.5 ? 1 : -1;
    const l = 1.5 + hash2(i, seed) * 3.5;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x + nx * l * side + (b.x - a.x) * 0.1, b.y + ny * l * side + (b.y - a.y) * 0.1);
    ctx.stroke();
  }
  ctx.restore();
}

/** Частковий розрив під час жесту: темна щілина з волокнами від входу до пальця. */
export function drawTearInProgress(ctx: CanvasRenderingContext2D, worldPath: Pt[], seed: number) {
  if (worldPath.length < 2) return;
  const rough = jagged(worldPath, 1.2, seed);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(12,20,26,0.85)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  rough.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1;
  ctx.translate(-1.2, -1.2);
  ctx.stroke();
  ctx.restore();
  drawFibers(ctx, rough, seed);
}
