"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { loadImage, loadJson, useSceneAssets } from "@/lib/scene/assets";
import type { Pt } from "@/lib/scene/geometry";
import { fbm, hash2 } from "@/lib/scene/heightfield";
import { useFrameLoop } from "@/lib/scene/loop";
import { makePiece, stepPieces, tearPiece, toLocal, toWorld, drawFibers, drawTearInProgress, type Piece } from "@/lib/scene/pieces";
import { usePointer } from "@/lib/scene/pointer";
import { detectQuality } from "@/lib/scene/quality";
import { haptic, sound } from "@/lib/scene/sound";
import { pointInPoly } from "@/lib/scene/tear";
import { RUSSIA_RINGS, RUSSIA_VIEW } from "@/lib/scenes/russia-outline";
import type { SceneProps } from "../types";

type Mode = "tear" | "burn" | "blast";
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "tear", label: "Рвати", hint: "Проведи пальцем, щоб розірвати." },
  { id: "burn", label: "Палити", hint: "Торкнись місця, звідки почнеться вогонь." },
  { id: "blast", label: "Знищити", hint: "Торкнись карти. Умовний ефект — лише папір, без людей і цілей." },
];

const VW = RUSSIA_VIEW.w;
const VH = RUSSIA_VIEW.h;
const PAD = 14; // поле аркуша навколо контуру (у світових одиницях)

interface Burn {
  gw: number;
  gh: number;
  /** 0 — цілий папір, (0..1) — горить, 1 — згоріло. */
  cells: Float32Array;
  /** Обвуглення 0..1 (накопичується, не згасає). */
  char: Float32Array;
  noise: Float32Array;
  charCanvas: HTMLCanvasElement;
  holeCanvas: HTMLCanvasElement;
  emberCanvas: HTMLCanvasElement;
  active: number;
}

interface Particle {
  kind: "flame" | "smoke" | "ash";
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  s: number;
  sprite: number;
  rot: number;
}

interface Cache {
  canvas: HTMLCanvasElement;
  shadow: HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
  version: number;
}

async function loadMap() {
  const meta = await loadJson<{ flames: { w: number; h: number }[] }>("/scenes/map/map.json");
  const [paper, ...flames] = await Promise.all([loadImage("/scenes/map/paper.webp"), ...meta.flames.map((_, i) => loadImage(`/scenes/map/flame-${i}.webp`))]);
  return { paper, flames };
}

export default function WarMapScene(props: SceneProps) {
  const assets = useSceneAssets(loadMap);
  if (assets.status === "loading") return <div role="status" className="grid h-full place-items-center text-sm text-mist">Готую карту…</div>;
  if (assets.status === "error")
    return (
      <div className="grid h-full place-items-center gap-3 px-6 text-center text-mist">
        <p>Не вдалося завантажити карту.</p>
        <button type="button" onClick={assets.retry} className="scene-btn border border-steel/60">
          Спробувати ще
        </button>
      </div>
    );
  return <WarMap {...props} data={assets.data} />;
}

function mapPath(): Path2D {
  const p = new Path2D();
  for (const r of RUSSIA_RINGS) {
    p.moveTo(r[0]!, r[1]!);
    for (let i = 2; i < r.length; i += 2) p.lineTo(r[i]!, r[i + 1]!);
    p.closePath();
  }
  return p;
}

function WarMap({ reducedMotion, setHint, onSettled, onInteract, data }: SceneProps & { data: Awaited<ReturnType<typeof loadMap>> }) {
  const { paper, flames } = data;
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const modeRef = useRef<Mode | null>(null);
  const [failed, setFailed] = useState(false);
  const quality = useMemo(() => detectQuality(), []);
  const shape = useMemo(() => mapPath(), []);

  const st = useRef({
    w: 1,
    h: 1,
    dpr: 1,
    view: { s: 1, ox: 0, oy: 0 },
    pieces: [] as Piece[],
    caches: new Map<number, Cache>(),
    slits: new Map<number, Pt[][]>(),
    burn: null as Burn | null,
    burnVersion: 0,
    particles: [] as Particle[],
    gesture: null as null | { id: number; path: Pt[]; target: Piece | null },
    blast: null as null | { x: number; y: number; t: number; torn: boolean },
    acts: 0,
    t: 0,
    dirty: true,
  });

  if (st.current.pieces.length === 0) {
    const s = st.current;
    s.pieces = [
      makePiece([
        { x: -PAD, y: -PAD },
        { x: VW + PAD, y: -PAD },
        { x: VW + PAD, y: VH + PAD },
        { x: -PAD, y: VH + PAD },
      ]),
    ];
  }

  const toWorldPt = (x: number, y: number): Pt => {
    const v = st.current.view;
    return { x: (x - v.ox) / v.s, y: (y - v.oy) / v.s };
  };

  const settle = useCallback(() => {
    const s = st.current;
    s.acts++;
    if (s.acts === 3) onSettled();
  }, [onSettled]);

  // ── Горіння ───────────────────────────────────────────────────
  const makeBurn = (): Burn => {
    const gw = quality.tier === "low" ? 200 : 300;
    const gh = Math.round((gw * (VH + PAD * 2)) / (VW + PAD * 2));
    const mk = () => {
      const c = document.createElement("canvas");
      c.width = gw;
      c.height = gh;
      return c;
    };
    const noise = new Float32Array(gw * gh);
    // Великі «язики» (низькочастотний шум) + дрібна нерівність волокон.
    for (let i = 0; i < noise.length; i++) {
      const x = i % gw;
      const y = Math.floor(i / gw);
      noise[i] = Math.min(1, Math.max(0, (fbm(x * 0.045, y * 0.045) - 0.3) * 1.9 * 0.8 + hash2(x, y * 1.7) * 0.2));
    }
    return { gw, gh, cells: new Float32Array(gw * gh), char: new Float32Array(gw * gh), noise, charCanvas: mk(), holeCanvas: mk(), emberCanvas: mk(), active: 0 };
  };
  const toCell = (b: Burn, p: Pt) => ({ x: ((p.x + PAD) / (VW + PAD * 2)) * b.gw, y: ((p.y + PAD) / (VH + PAD * 2)) * b.gh });
  const toSheet = (b: Burn, x: number, y: number): Pt => ({ x: (x / b.gw) * (VW + PAD * 2) - PAD, y: (y / b.gh) * (VH + PAD * 2) - PAD });

  /** Підпалити в точці аркуша (локальні координати шматка = координати аркуша). */
  const ignite = (local: Pt, radius: number, strength = 0.02) => {
    const s = st.current;
    s.burn ??= makeBurn();
    const b = s.burn;
    const c = toCell(b, local);
    const r = (radius / (VW + PAD * 2)) * b.gw;
    for (let y = Math.max(0, Math.floor(c.y - r)); y < Math.min(b.gh, c.y + r); y++)
      for (let x = Math.max(0, Math.floor(c.x - r)); x < Math.min(b.gw, c.x + r); x++) {
        const i = y * b.gw + x;
        if (b.cells[i] === 0 && Math.hypot(x - c.x, y - c.y) < r) b.cells[i] = strength;
      }
    b.active = Math.max(1, b.active);
  };

  const stepBurn = (dt: number) => {
    const b = st.current.burn;
    if (!b || b.active === 0) return false;
    const { gw, gh, cells, char, noise } = b;
    const speed = reducedMotion ? 0.5 : 1;
    const next = cells.slice();
    let active = 0;
    for (let y = 1; y < gh - 1; y++)
      for (let x = 1; x < gw - 1; x++) {
        const i = y * gw + x;
        const v = cells[i]!;
        if (v <= 0 || v >= 1) continue;
        active++;
        next[i] = Math.min(1, v + dt * (0.45 + 0.35 * noise[i]!) * speed);
        char[i] = Math.max(char[i]!, Math.min(1, v * 1.6));
        if (v > 0.12 && v < 0.9) {
          // Фронт іде нерівно: волокна паперу горять по-різному.
          for (const j of [i - 1, i + 1, i - gw, i + gw, i - gw - 1, i + gw + 1, i - gw + 1, i + gw - 1]) {
            if (cells[j] !== 0) continue;
            if (Math.random() < dt * 9 * speed * Math.pow(noise[j]!, 1.6)) next[j] = 0.01;
          }
        }
        // Довкола фронту папір темніє ще до вогню (жар).
        for (const j of [i - 2, i + 2, i - 2 * gw, i + 2 * gw]) if (j > 0 && j < char.length) char[j] = Math.max(char[j]!, 0.35 * v);
      }
    cells.set(next);
    b.active = active;
    // Маски.
    const put = (canvas: HTMLCanvasElement, fn: (i: number) => [number, number, number, number]) => {
      const c = canvas.getContext("2d")!;
      const img = c.createImageData(gw, gh);
      const d = img.data;
      for (let i = 0; i < cells.length; i++) {
        const [r, g, bl, a] = fn(i);
        d[i * 4] = r;
        d[i * 4 + 1] = g;
        d[i * 4 + 2] = bl;
        d[i * 4 + 3] = a;
      }
      c.putImageData(img, 0, 0);
    };
    put(b.charCanvas, (i) => {
      const c = char[i]!;
      // Від коричневого до вугільно-чорного.
      return [40 - 20 * c, 26 - 14 * c, 16 - 8 * c, Math.min(255, c * 255)];
    });
    put(b.holeCanvas, (i) => [0, 0, 0, cells[i]! > 0.78 + noise[i]! * 0.15 ? 255 : 0]);
    put(b.emberCanvas, (i) => {
      const v = cells[i]!;
      const glow = v > 0.03 && v < 0.85 ? Math.sin(((v - 0.03) * Math.PI) / 0.82) : 0;
      return [255, 92 + 70 * glow * glow, 28, glow * 170];
    });
    st.current.burnVersion++;
    return active > 0;
  };

  // ── Кеш шматків (зміст + тінь) ──────────────────────────────
  const renderPiece = (p: Piece): Cache => {
    const s = st.current;
    const old = s.caches.get(p.id);
    const version = s.burnVersion;
    if (old && old.version === version) return old;
    const xs = p.poly.map((q) => q.x);
    const ys = p.poly.map((q) => q.y);
    const bx = Math.max(-PAD, Math.min(...xs)) - 4;
    const by = Math.max(-PAD, Math.min(...ys)) - 4;
    const bw = Math.min(VW + PAD, Math.max(...xs)) + 4 - bx;
    const bh = Math.min(VH + PAD, Math.max(...ys)) + 4 - by;
    const rs = Math.min(2, s.view.s * s.dpr);
    const W = Math.max(2, Math.ceil(bw * rs));
    const H = Math.max(2, Math.ceil(bh * rs));
    const canvas = old?.canvas ?? document.createElement("canvas");
    const shadow = old?.shadow ?? document.createElement("canvas");
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    const g = canvas.getContext("2d")!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    g.setTransform(rs, 0, 0, rs, -bx * rs, -by * rs);
    g.save();
    g.beginPath();
    p.poly.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
    g.closePath();
    g.clip();
    g.clip(shape);
    g.drawImage(paper, 0, 0, VW, VH);
    // Край розриву: світле волокнисте серце паперу й товщина.
    for (const edge of p.torn) {
      g.strokeStyle = "rgba(245,240,228,0.95)";
      g.lineWidth = 3.2;
      g.beginPath();
      edge.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
      g.stroke();
      drawFibers(g, edge, p.id);
    }
    for (const slit of s.slits.get(p.id) ?? []) drawTearInProgress(g, slit, p.id);
    const b = s.burn;
    if (b) {
      g.imageSmoothingEnabled = true;
      g.globalCompositeOperation = "source-atop";
      g.drawImage(b.charCanvas, -PAD, -PAD, VW + PAD * 2, VH + PAD * 2);
      g.globalCompositeOperation = "destination-out";
      g.drawImage(b.holeCanvas, -PAD, -PAD, VW + PAD * 2, VH + PAD * 2);
      g.globalCompositeOperation = "source-over";
    }
    g.restore();
    // Тінь — запечена з альфи змісту (дешево малювати щокадру).
    if (shadow.width !== W + 40 || shadow.height !== H + 40) {
      shadow.width = W + 40;
      shadow.height = H + 40;
    }
    const sg = shadow.getContext("2d")!;
    sg.clearRect(0, 0, shadow.width, shadow.height);
    sg.shadowColor = "rgba(0,0,0,0.75)";
    sg.shadowBlur = 7 * rs;
    sg.shadowOffsetX = 20000;
    sg.drawImage(canvas, 20 - 20000, 20);
    const c: Cache = { canvas, shadow, x: bx, y: by, w: bw, h: bh, version };
    s.caches.set(p.id, c);
    return c;
  };

  const draw = () => {
    const s = st.current;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const { s: sc, ox, oy } = s.view;
    const dpr = s.dpr;
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * oy);
    // Світло на столі.
    const lg = ctx.createRadialGradient(VW / 2, VH * 0.45, 30, VW / 2, VH / 2, VW * 0.8);
    lg.addColorStop(0, "rgba(80,80,82,0.35)");
    lg.addColorStop(1, "rgba(20,21,22,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(-VW, -VH, VW * 3, VH * 3);
    const b = s.burn;
    // Тіні шматків, потім самі шматки.
    for (const p of s.pieces) {
      const c = renderPiece(p);
      const rs = c.canvas.width / c.w;
      const lift = 3 + Math.hypot(p.vx, p.vy) * 0.03;
      ctx.save();
      ctx.translate(p.c.x + p.x, p.c.y + p.y);
      ctx.rotate(p.rot);
      ctx.translate(-p.c.x, -p.c.y);
      ctx.drawImage(c.shadow, c.x - 20 / rs + lift * 0.6, c.y - 20 / rs + lift, c.w + 40 / rs, c.h + 40 / rs);
      ctx.restore();
    }
    for (const p of s.pieces) {
      const c = renderPiece(p);
      ctx.save();
      ctx.translate(p.c.x + p.x, p.c.y + p.y);
      ctx.rotate(p.rot);
      ctx.translate(-p.c.x, -p.c.y);
      ctx.drawImage(c.canvas, c.x, c.y, c.w, c.h);
      // Жар уздовж фронту — тільки там, де є папір цього шматка.
      if (b && b.active > 0) {
        ctx.save();
        ctx.beginPath();
        p.poly.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.closePath();
        ctx.clip();
        ctx.clip(shape);
        ctx.globalCompositeOperation = "lighter";
        ctx.drawImage(b.emberCanvas, -PAD, -PAD, VW + PAD * 2, VH + PAD * 2);
        ctx.restore();
      }
      ctx.restore();
    }
    // Полумʼя (спрайти з фото горіння), дим, попіл.
    for (const q of s.particles) {
      const a = Math.sin(Math.PI * Math.min(1, q.life / q.max));
      if (q.kind === "flame") {
        const img = flames[q.sprite]!;
        const w = img.naturalWidth * q.s;
        const h = img.naturalHeight * q.s * (0.9 + 0.2 * Math.sin(q.life * 9 + q.sprite));
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = a * 0.9;
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.drawImage(img, -w / 2, -h, w, h);
        ctx.restore();
      } else if (q.kind === "smoke") {
        const r = q.s * (1 + q.life);
        const gr = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
        gr.addColorStop(0, `rgba(120,118,115,${0.16 * a})`);
        gr.addColorStop(1, "rgba(120,118,115,0)");
        ctx.fillStyle = gr;
        ctx.fillRect(q.x - r, q.y - r, r * 2, r * 2);
      } else {
        ctx.fillStyle = `rgba(30,28,26,${0.8 * a})`;
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.fillRect(-q.s, -q.s * 0.6, q.s * 2, q.s * 1.2);
        ctx.restore();
      }
    }
    // Умовний «вибух»: тепле мʼяке світло без спалаху й кільце хвилі.
    const bl = s.blast;
    if (bl) {
      const rise = Math.min(1, bl.t / 0.6);
      const fall = Math.max(0, 1 - Math.max(0, bl.t - 0.6) / 2);
      const light = 0.28 * rise * fall;
      const g2 = ctx.createRadialGradient(bl.x, bl.y, 0, bl.x, bl.y, VW * 0.9);
      g2.addColorStop(0, `rgba(255,214,170,${light})`);
      g2.addColorStop(1, "rgba(255,214,170,0)");
      ctx.fillStyle = g2;
      ctx.fillRect(-VW, -VH, VW * 3, VH * 3);
      if (!reducedMotion && bl.t < 1.6) {
        ctx.strokeStyle = `rgba(240,235,225,${0.3 * (1 - bl.t / 1.6)})`;
        ctx.lineWidth = 12 * (1 - bl.t / 1.6) + 1;
        ctx.beginPath();
        ctx.arc(bl.x, bl.y, bl.t * VW * 0.7, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // Розрив, що зараз іде за пальцем.
    const gst = s.gesture;
    if (gst?.target && gst.path.length > 1) drawTearInProgress(ctx, gst.path, gst.target.id);
  };

  // ── Частинки ──────────────────────────────────────────────────
  const spawnFromFront = (dt: number) => {
    const s = st.current;
    const b = s.burn;
    if (!b || b.active === 0 || reducedMotion) return;
    const want = Math.min(6, b.active / 60) * dt * 30;
    for (let k = 0; k < want && s.particles.length < (quality.tier === "low" ? 50 : 110); k++) {
      // Випадкова клітинка фронту.
      for (let tries = 0; tries < 30; tries++) {
        const i = Math.floor(Math.random() * b.cells.length);
        const v = b.cells[i]!;
        if (v <= 0.05 || v >= 0.7) continue;
        const local = toSheet(b, i % b.gw, Math.floor(i / b.gw));
        const piece = s.pieces.find((p) => pointInPoly(local, p.poly));
        if (!piece) break;
        const w = toWorld(piece, local);
        const r = Math.random();
        if (r < 0.7) s.particles.push({ kind: "flame", x: w.x, y: w.y, vx: (Math.random() - 0.5) * 6, vy: -8 - Math.random() * 10, life: 0, max: 0.6 + Math.random() * 0.8, s: 0.25 + Math.random() * 0.3, sprite: Math.floor(Math.random() * flames.length), rot: (Math.random() - 0.5) * 0.3 });
        else if (r < 0.9) s.particles.push({ kind: "smoke", x: w.x, y: w.y - 6, vx: (Math.random() - 0.5) * 8, vy: -16 - Math.random() * 14, life: 0, max: 1.6 + Math.random(), s: 10 + Math.random() * 14, sprite: 0, rot: 0 });
        else s.particles.push({ kind: "ash", x: w.x, y: w.y, vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 20, life: 0, max: 1.2 + Math.random(), s: 1 + Math.random() * 1.6, sprite: 0, rot: Math.random() * 3 });
        break;
      }
    }
  };
  const stepParticles = (dt: number) => {
    const s = st.current;
    for (const q of s.particles) {
      q.life += dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (q.kind === "ash") {
        q.vy += 14 * dt;
        q.rot += dt * 2;
      }
    }
    s.particles = s.particles.filter((q) => q.life < q.max);
    return s.particles.length > 0;
  };

  // ── Умовний вибух ─────────────────────────────────────────────
  const blastAt = (w: Pt) => {
    const s = st.current;
    if (s.blast) return;
    s.blast = { x: w.x, y: w.y, t: 0, torn: false };
    const piece = s.pieces.find((p) => pointInPoly(toLocal(p, w), p.poly));
    if (piece) {
      const l = toLocal(piece, w);
      ignite(l, 60, 0.5);
      for (let k = 0; k < 6; k++) ignite({ x: l.x + (Math.random() - 0.5) * 220, y: l.y + (Math.random() - 0.5) * 140 }, 9, 0.1);
    }
    sound.play("rumble", 0.7);
    haptic(30);
    setHint("Карти в такому вигляді більше немає.");
    settle();
  };

  const wake = useFrameLoop(rootRef, (dt) => {
    const s = st.current;
    s.t += dt;
    let busy = stepPieces(s.pieces, dt);
    if (s.burn && s.burn.active > 0) {
      busy = stepBurn(dt) || busy;
      spawnFromFront(dt);
      if (Math.random() < dt * 3) sound.play("fire", 0.25);
    }
    busy = stepParticles(dt) || busy;
    const bl = s.blast;
    if (bl) {
      bl.t += dt * (reducedMotion ? 3 : 1);
      if (!bl.torn && bl.t > 0.35) {
        bl.torn = true;
        // Радіальні розриви від точки — папір розлітається на шматки.
        const rays = 5;
        for (let k = 0; k < rays; k++) {
          const a = (k / rays) * Math.PI * 2 + Math.random() * 0.6;
          const path: Pt[] = [];
          for (let i = -30; i <= 30; i++) {
            const r = (i / 30) * VW * 1.2;
            path.push({ x: bl.x + Math.cos(a) * r + Math.sin(i * 0.9) * 5, y: bl.y + Math.sin(a) * r + Math.cos(i * 0.7) * 5 });
          }
          for (const p of [...s.pieces]) {
            const res = tearPiece(p, path, 2.4);
            if (res) s.pieces = [...s.pieces.filter((q) => q !== p), ...res];
          }
        }
        for (const p of s.pieces) {
          const c = toWorld(p, p.c);
          const dx = c.x - bl.x;
          const dy = c.y - bl.y;
          const d = Math.hypot(dx, dy) || 1;
          const sp = reducedMotion ? 30 : 220 + Math.random() * 120;
          p.vx = (dx / d) * sp;
          p.vy = (dy / d) * sp;
          p.vr = (Math.random() - 0.5) * (reducedMotion ? 0 : 1.4);
        }
        if (!reducedMotion)
          for (let k = 0; k < 40; k++) {
            const a = Math.random() * Math.PI * 2;
            const v = 30 + Math.random() * 90;
            s.particles.push({ kind: k % 3 ? "smoke" : "ash", x: bl.x, y: bl.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, life: 0, max: 1.5 + Math.random() * 1.5, s: k % 3 ? 16 + Math.random() * 20 : 1.5 + Math.random() * 2, sprite: 0, rot: Math.random() * 3 });
          }
      }
      if (bl.t > 2.8) s.blast = null;
      busy = true;
    }
    draw();
    return busy || Boolean(s.gesture);
  });

  // Розмір і вид.
  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas || !canvas.getContext("2d")) {
      setFailed(true);
      return;
    }
    const resize = () => {
      const s = st.current;
      const w = root.clientWidth;
      const h = root.clientHeight;
      s.w = w;
      s.h = h;
      s.dpr = quality.dpr;
      const sc = Math.min((w - 16) / (VW + PAD * 2), (h - 24) / (VH + PAD * 2));
      s.view = { s: sc, ox: (w - VW * sc) / 2, oy: (h - VH * sc) / 2 };
      canvas.width = Math.round(w * s.dpr);
      canvas.height = Math.round(h * s.dpr);
      s.caches.clear();
      wake();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(root);
    return () => ro.disconnect();
  }, [quality.dpr, wake]);

  /** Розрив, що почався всередині: продовжуємо назад до краю, щоб він перетнув межу двічі. */
  const tearAlong = (target: Piece, path: Pt[], extendEnd: boolean) => {
    const s = st.current;
    if (path.length < 2) return false;
    const a = path[0]!;
    const b = path[1]!;
    const dir = { x: a.x - b.x, y: a.y - b.y };
    const L = Math.hypot(dir.x, dir.y) || 1;
    const back = { x: a.x + (dir.x / L) * VW * 1.5, y: a.y + (dir.y / L) * VW * 1.5 };
    let full = [back, ...path];
    if (extendEnd) {
      const z = path[path.length - 1]!;
      const y = path[Math.max(0, path.length - 4)]!;
      const d2 = { x: z.x - y.x, y: z.y - y.y };
      const L2 = Math.hypot(d2.x, d2.y) || 1;
      full = [...full, { x: z.x + (d2.x / L2) * VW * 1.5, y: z.y + (d2.y / L2) * VW * 1.5 }];
    }
    const res = tearPiece(target, full, 4.5);
    if (!res) return false;
    s.pieces = [...s.pieces.filter((q) => q !== target), ...res];
    s.caches.delete(target.id);
    sound.play("tear", 0.9);
    haptic(18);
    settle();
    return true;
  };

  usePointer(rootRef, {
    down: (p) => {
      const m = modeRef.current;
      if (!m) return false;
      onInteract();
      const w = toWorldPt(p.x, p.y);
      const s = st.current;
      if (m === "burn") {
        const piece = [...s.pieces].reverse().find((q) => pointInPoly(toLocal(q, w), q.poly));
        if (!piece) return false;
        ignite(toLocal(piece, w), 7);
        sound.play("fire", 0.6);
        setHint("Вогонь іде від точки дотику. Можна підпалити ще.");
        settle();
        wake();
        return false;
      }
      if (m === "blast") {
        blastAt(w);
        wake();
        return false;
      }
      s.gesture = { id: p.id, path: [w], target: null };
      wake();
    },
    move: (p) => {
      const s = st.current;
      const g = s.gesture;
      if (!g || g.id !== p.id) return;
      const w = toWorldPt(p.x, p.y);
      const last = g.path[g.path.length - 1]!;
      if (Math.hypot(w.x - last.x, w.y - last.y) < 3 / s.view.s) return;
      g.path.push(w);
      if (!g.target) {
        g.target = [...s.pieces].reverse().find((q) => pointInPoly(toLocal(q, w), q.poly)) ?? null;
        if (g.target) g.path = [last, w];
      } else if (!pointInPoly(toLocal(g.target, w), g.target.poly)) {
        // Вийшли за край шматка — розрив завершено.
        tearAlong(g.target, g.path, false);
        s.gesture = { id: p.id, path: [w], target: null };
      } else if (Math.random() < 0.35) sound.play("tear", 0.35);
      wake();
    },
    up: (p, cancelled) => {
      const s = st.current;
      const g = s.gesture;
      if (!g || g.id !== p.id) return;
      s.gesture = null;
      if (!cancelled && g.target && g.path.length > 2) {
        // Довгий рух усередині — дорвати в тому ж напрямку; короткий — лишається надрив.
        let len = 0;
        for (let i = 1; i < g.path.length; i++) len += Math.hypot(g.path[i]!.x - g.path[i - 1]!.x, g.path[i]!.y - g.path[i - 1]!.y);
        if (len > VW * 0.22) tearAlong(g.target, g.path, true);
        else if (len > 12) {
          const local = g.path.map((q) => toLocal(g.target!, q));
          const list = s.slits.get(g.target.id) ?? [];
          s.slits.set(g.target.id, [...list, local]);
          s.caches.delete(g.target.id);
          sound.play("tear", 0.5);
        }
      }
      wake();
    },
  });

  const pick = (m: Mode) => {
    setMode(m);
    modeRef.current = m;
    setHint(MODES.find((x) => x.id === m)!.hint);
    onInteract();
  };

  /** Кнопкова альтернатива. */
  const keyboardAct = () => {
    const s = st.current;
    const m = modeRef.current;
    const c = { x: VW * (0.3 + Math.random() * 0.4), y: VH * (0.35 + Math.random() * 0.3) };
    const piece = s.pieces.find((q) => pointInPoly(toLocal(q, c), q.poly)) ?? s.pieces[0];
    if (!piece) return;
    if (m === "burn") {
      ignite(toLocal(piece, c), 8);
      settle();
    } else if (m === "blast") blastAt(c);
    else {
      const a = Math.random() * Math.PI;
      const path = Array.from({ length: 25 }, (_, i) => ({ x: c.x + Math.cos(a) * (i - 12) * 60, y: c.y + Math.sin(a) * (i - 12) * 60 + Math.sin(i) * 4 }));
      tearAlong(piece, path, true);
    }
    wake();
  };

  if (failed) return <div className="grid h-full place-items-center px-6 text-center text-mist">Цей пристрій не показує сцену. Спробуй іншу дію.</div>;

  return (
    <div className="flex h-full flex-col">
      <div ref={rootRef} className="scene-surface relative min-h-0 flex-1">
        <canvas ref={canvasRef} role="img" aria-label="Паперова карта рф у визнаних межах, без Криму й окупованих територій України. Її можна рвати, палити або умовно знищити." className="absolute inset-0 h-full w-full" />
        {!mode && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-[rgb(20,21,22,0.35)] px-4">
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-frost/85">Що зробити з картою?</p>
              <div className="flex flex-wrap justify-center gap-2">
                {MODES.map((m) => (
                  <button key={m.id} type="button" onClick={() => pick(m.id)} className="min-h-14 min-w-28 rounded-[var(--radius-edge)] border border-frost/60 bg-night/85 px-5 font-display text-xl text-frost hover:bg-slate">
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      {mode && (
        <div className="flex flex-wrap items-center justify-center gap-2 px-3 pt-2">
          <div role="radiogroup" aria-label="Дія" className="flex overflow-hidden rounded-[var(--radius-hair)] border border-steel/50">
            {MODES.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} onClick={() => pick(m.id)} className={cn("min-h-11 px-3 text-sm", mode === m.id ? "bg-frost text-abyss" : "text-frost/80 hover:bg-night")}>
                {m.label}
              </button>
            ))}
          </div>
          <button type="button" className="scene-btn border border-steel/50" onClick={keyboardAct}>
            {mode === "tear" ? "Розірвати" : mode === "burn" ? "Підпалити" : "Запустити"}
          </button>
        </div>
      )}
    </div>
  );
}
