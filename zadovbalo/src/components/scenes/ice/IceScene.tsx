"use client";

import { useEffect, useRef, useState } from "react";
import { area, roundedRect, voronoiCells, type Pt } from "@/lib/scene/geometry";
import { hash2 } from "@/lib/scene/heightfield";
import { useFrameLoop } from "@/lib/scene/loop";
import { bindPointer } from "@/lib/scene/pointer";
import { detectQuality } from "@/lib/scene/quality";
import { haptic, sound } from "@/lib/scene/sound";
import { centroid, pointInPoly } from "@/lib/scene/tear";
import type { SceneProps } from "../types";

interface Crack {
  /** Гілки — ламані від точки удару; ростуть від 0 до повної довжини. */
  branches: Pt[][];
  lengths: number[];
  progress: number;
  speed: number;
  origin: Pt;
}

interface Shard {
  poly: Pt[];
  c: Pt;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  melt: number;
  meltRate: number;
}

const SHATTER_AT = 5;

function makeCrack(origin: Pt, intensity: number, seed: number, reduced: boolean): Crack {
  const n = 3 + intensity + Math.floor(hash2(seed, 1) * 2);
  const branches: Pt[][] = [];
  const base = hash2(seed, 2) * Math.PI * 2;
  const grow = (start: Pt, dir: number, len: number, depth: number, k: number) => {
    const pts = [start];
    let a = dir;
    let p = start;
    const steps = Math.max(2, Math.round(len / 7));
    for (let i = 0; i < steps; i++) {
      a += (hash2(seed + k, i) - 0.5) * 0.7;
      p = { x: p.x + Math.cos(a) * (len / steps), y: p.y + Math.sin(a) * (len / steps) };
      pts.push(p);
      if (depth < 2 && hash2(seed + k * 3, i + 40) > 0.83) grow(p, a + (hash2(seed, i + k) > 0.5 ? 0.7 : -0.7), len * 0.45, depth + 1, k * 7 + i);
    }
    branches.push(pts);
  };
  for (let i = 0; i < n; i++) {
    const dir = base + (i / n) * Math.PI * 2 + (hash2(seed, i + 10) - 0.5) * 0.6;
    grow(origin, dir, (55 + hash2(seed, i + 20) * 75) * (0.75 + 0.2 * intensity), 0, i + 1);
  }
  const lengths = branches.map((b) => b.slice(1).reduce((acc, q, i) => acc + Math.hypot(q.x - b[i]!.x, q.y - b[i]!.y), 0));
  return { branches, lengths, progress: reduced ? 1 : 0, speed: 0.9 + 0.2 * intensity, origin };
}

export default function IceScene({ intensity, reducedMotion, setHint, onSettled }: SceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<"whole" | "shards" | "melted">("whole");
  const [crackCount, setCrackCount] = useState(0);
  const intensityRef = useRef(intensity);
  useEffect(() => {
    intensityRef.current = intensity;
  });
  const st = useRef({
    w: 1,
    h: 1,
    dpr: 1,
    center: { x: 0, y: 0 },
    poly: [] as Pt[],
    cracks: [] as Crack[],
    shards: [] as Shard[],
    puddle: 0,
    bubbles: [] as { x: number; y: number; r: number }[],
    seed: 1,
    dirty: true,
    shattered: false,
  });

  const icePath = (ctx: CanvasRenderingContext2D, poly: Pt[]) => {
    ctx.beginPath();
    poly.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
  };

  /** Лід: напівпрозорий, з холодним світлом усередині, фаскою й бульбашками. */
  const drawIce = (ctx: CanvasRenderingContext2D, poly: Pt[], alpha: number, size: number) => {
    const s = st.current;
    const c = centroid(poly);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 14;
    // Товщина брили: нижня грань трохи темніша й зсунута вниз.
    const depth = size * 0.09;
    ctx.save();
    ctx.translate(0, depth);
    ctx.fillStyle = "rgba(70,110,128,0.45)";
    icePath(ctx, poly);
    ctx.fill();
    ctx.restore();
    ctx.shadowColor = "transparent";
    const body = ctx.createLinearGradient(c.x - size, c.y - size, c.x + size, c.y + size);
    body.addColorStop(0, "rgba(214,234,240,0.55)");
    body.addColorStop(0.5, "rgba(150,190,205,0.32)");
    body.addColorStop(1, "rgba(90,130,150,0.42)");
    ctx.fillStyle = body;
    icePath(ctx, poly);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.save();
    icePath(ctx, poly);
    ctx.clip();
    // Холодне світло зсередини.
    const glow = ctx.createRadialGradient(c.x - size * 0.2, c.y - size * 0.25, 4, c.x, c.y, size * 1.1);
    glow.addColorStop(0, "rgba(235,246,250,0.35)");
    glow.addColorStop(1, "rgba(235,246,250,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(c.x - size * 2, c.y - size * 2, size * 4, size * 4);
    // Бульбашки.
    ctx.fillStyle = "rgba(240,248,250,0.35)";
    for (const b of s.bubbles) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Відблиск.
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = size * 0.08;
    ctx.beginPath();
    ctx.moveTo(c.x - size * 0.9, c.y - size * 0.2);
    ctx.lineTo(c.x - size * 0.2, c.y - size * 0.75);
    ctx.stroke();
    ctx.restore();
    // Фаска: світлий внутрішній край.
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(240,250,252,0.65)";
    icePath(ctx, poly);
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(240,250,252,0.08)";
    ctx.stroke();
    ctx.restore();
  };

  const drawCrack = (ctx: CanvasRenderingContext2D, k: Crack) => {
    const t = k.progress;
    // Мʼяка паморозь у точці удару — без спалаху.
    const frost = ctx.createRadialGradient(k.origin.x, k.origin.y, 0, k.origin.x, k.origin.y, 22);
    frost.addColorStop(0, `rgba(240,248,250,${0.4 * Math.min(1, t * 2)})`);
    frost.addColorStop(1, "rgba(240,248,250,0)");
    ctx.fillStyle = frost;
    ctx.fillRect(k.origin.x - 24, k.origin.y - 24, 48, 48);
    k.branches.forEach((b, bi) => {
      const limit = k.lengths[bi]! * t;
      const pts: Pt[] = [b[0]!];
      let acc = 0;
      for (let i = 1; i < b.length; i++) {
        const seg = Math.hypot(b[i]!.x - b[i - 1]!.x, b[i]!.y - b[i - 1]!.y);
        if (acc + seg > limit) {
          const f = (limit - acc) / seg;
          pts.push({ x: b[i - 1]!.x + (b[i]!.x - b[i - 1]!.x) * f, y: b[i - 1]!.y + (b[i]!.y - b[i - 1]!.y) * f });
          break;
        }
        acc += seg;
        pts.push(b[i]!);
      }
      const stroke = (dx: number, dy: number, color: string, width: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        pts.forEach((q, i) => (i ? ctx.lineTo(q.x + dx, q.y + dy) : ctx.moveTo(q.x + dx, q.y + dy)));
        ctx.stroke();
      };
      stroke(0, 0, "rgba(240,250,252,0.08)", 5);
      stroke(1.2, 1.2, "rgba(30,60,75,0.35)", 1.2);
      stroke(0, 0, "rgba(248,252,253,0.9)", 1.1);
    });
  };

  const draw = () => {
    const s = st.current;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, s.w, s.h);
    const size = Math.min(s.w, s.h) * 0.36;
    // Калюжа, що росте з таненням.
    if (s.puddle > 0) {
      const py = s.center.y + size * 0.85;
      const pg = ctx.createRadialGradient(s.center.x, py, 4, s.center.x, py, size * 1.6 * Math.min(1, 0.4 + s.puddle));
      pg.addColorStop(0, `rgba(140,180,195,${0.28 * s.puddle})`);
      pg.addColorStop(0.7, `rgba(110,154,156,${0.12 * s.puddle})`);
      pg.addColorStop(1, "rgba(110,154,156,0)");
      ctx.save();
      ctx.translate(0, py);
      ctx.scale(1, 0.32);
      ctx.translate(0, -py);
      ctx.fillStyle = pg;
      ctx.fillRect(0, py - size * 2, s.w, size * 4);
      ctx.restore();
    }
    if (!s.shattered) {
      drawIce(ctx, s.poly, 1, size);
      ctx.save();
      icePath(ctx, s.poly);
      ctx.clip();
      for (const k of s.cracks) drawCrack(ctx, k);
      ctx.restore();
    } else {
      for (const sh of s.shards) {
        if (sh.melt >= 1) continue;
        ctx.save();
        ctx.translate(sh.c.x + sh.x, sh.c.y + sh.y);
        ctx.rotate(sh.rot);
        const k = 1 - 0.55 * sh.melt;
        ctx.scale(k, k);
        ctx.translate(-sh.c.x, -sh.c.y);
        drawIce(ctx, sh.poly, 1 - sh.melt * 0.8, size * 0.5);
        ctx.save();
        icePath(ctx, sh.poly);
        ctx.clip();
        for (const c of s.cracks) drawCrack(ctx, c);
        ctx.restore();
        ctx.restore();
      }
    }
  };

  const shatter = () => {
    const s = st.current;
    if (s.shattered) return;
    const seeds: Pt[] = [];
    for (const k of s.cracks) {
      seeds.push(k.origin);
      for (const b of k.branches) seeds.push(b[b.length - 1]!);
    }
    const inside = seeds.filter((q) => pointInPoly(q, s.poly)).slice(0, 26);
    const cells = voronoiCells(s.poly, inside).filter((c) => c.length >= 3 && area(c) > 60);
    s.shards = cells.map((poly, i) => {
      const c = centroid(poly);
      const dx = c.x - s.center.x;
      const dy = c.y - s.center.y;
      const len = Math.hypot(dx, dy) || 1;
      const sp = reducedMotion ? 8 : 26 + hash2(i, 5) * 22;
      return { poly, c, x: 0, y: 0, vx: (dx / len) * sp, vy: (dy / len) * sp, rot: 0, vr: (hash2(i, 9) - 0.5) * (reducedMotion ? 0 : 0.25), melt: 0, meltRate: 0.07 + hash2(i, 3) * 0.05 };
    });
    s.shattered = true;
    setPhase("shards");
    sound.play("crack", 0.6);
    setHint("Уламки розходяться й тануть. Можна просто дивитися.");
  };

  const wake = useFrameLoop(rootRef, (dt) => {
    const s = st.current;
    let busy = false;
    for (const k of s.cracks)
      if (k.progress < 1) {
        k.progress = Math.min(1, k.progress + dt * k.speed);
        busy = true;
      }
    if (s.shattered) {
      let alive = 0;
      for (const sh of s.shards) {
        if (sh.melt >= 1) continue;
        alive++;
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        sh.vx *= Math.pow(0.35, dt);
        sh.vy *= Math.pow(0.35, dt);
        sh.rot += sh.vr * dt;
        sh.vr *= Math.pow(0.4, dt);
        sh.melt = Math.min(1, sh.melt + sh.meltRate * dt);
      }
      s.puddle = Math.min(1, s.puddle + dt * 0.08);
      busy = alive > 0;
      if (!busy) {
        setPhase("melted");
        setHint("Розтануло.");
        onSettled();
      }
    }
    if (busy || s.dirty) {
      draw();
      s.dirty = false;
    }
    return busy;
  });

  const hit = (p: Pt) => {
    const s = st.current;
    s.seed += 17;
    s.cracks.push(makeCrack(p, intensityRef.current, s.seed, reducedMotion));
    setCrackCount(s.cracks.length);
    sound.play("crack", 0.35 + 0.15 * intensityRef.current);
    haptic(10);
    if (s.cracks.length === 1) setHint("Ще. Тріщини ростуть від кожного дотику.");
    if (s.cracks.length >= SHATTER_AT) window.setTimeout(shatter, reducedMotion ? 100 : 900);
    wake();
  };

  const hitRef = useRef(hit);
  useEffect(() => {
    hitRef.current = hit;
  });

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!root || !canvas || !ctx) {
      setFailed(true);
      return;
    }
    const s = st.current;
    const resize = () => {
      const w = root.clientWidth;
      const h = root.clientHeight;
      const dpr = detectQuality().dpr;
      const ox = w / 2 - s.center.x;
      const oy = h / 2 - s.center.y;
      Object.assign(s, { w, h, dpr });
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      if (!s.poly.length) {
        const bw = Math.min(w * 0.8, h * 0.85, 440);
        const bh = bw * 0.72;
        s.center = { x: w / 2, y: h / 2 };
        s.poly = roundedRect(bw, bh, bw * 0.08, 5).map((q, i) => ({ x: q.x + w / 2 + (hash2(i, 2) - 0.5) * 6, y: q.y + h / 2 + (hash2(i, 4) - 0.5) * 6 }));
        s.bubbles = Array.from({ length: 26 }, (_, i) => ({ x: w / 2 + (hash2(i, 7) - 0.5) * bw * 0.85, y: h / 2 + (hash2(i, 8) - 0.5) * bh * 0.8, r: 0.6 + hash2(i, 9) * 2.2 }));
      } else {
        // Зсув при ресайзі/повороті.
        s.center = { x: s.center.x + ox, y: s.center.y + oy };
        const move = (q: Pt) => ({ x: q.x + ox, y: q.y + oy });
        s.poly = s.poly.map(move);
        s.bubbles = s.bubbles.map((b) => ({ ...b, ...move(b) }));
        for (const k of s.cracks) {
          k.origin = move(k.origin);
          k.branches = k.branches.map((b) => b.map(move));
        }
        for (const sh of s.shards) {
          sh.poly = sh.poly.map(move);
          sh.c = move(sh.c);
        }
      }
      s.dirty = true;
      wake();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(root);
    const unbind = bindPointer(root, {
      down: (p) => {
        if (s.shattered || !pointInPoly(p, s.poly)) return false;
        hitRef.current(p);
      },
    });
    return () => {
      ro.disconnect();
      unbind();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- привʼязка один раз
  }, []);

  const crackButton = () => {
    const s = st.current;
    if (s.shattered) return;
    const c = s.center;
    hit({ x: c.x + (Math.random() - 0.5) * 160, y: c.y + (Math.random() - 0.5) * 100 });
  };

  if (failed) return <div className="grid h-full place-items-center px-6 text-center text-mist">Цей пристрій не показує сцену. Спробуй іншу дію.</div>;

  return (
    <div className="flex h-full flex-col">
      <div ref={rootRef} className="scene-surface relative min-h-0 flex-1">
        <canvas ref={canvasRef} role="img" aria-label="Брила льоду. Торкайся, щоб пускати тріщини." className="absolute inset-0 h-full w-full" />
      </div>
      <div className="flex flex-wrap justify-center gap-2 px-3 pt-2">
        <button type="button" className="scene-btn border border-steel/50 disabled:opacity-40" disabled={phase !== "whole"} onClick={crackButton}>
          Пустити тріщину
        </button>
        <button type="button" className="scene-btn border border-steel/50 disabled:opacity-40" disabled={phase !== "whole" || crackCount < 2} onClick={shatter}>
          Розколоти
        </button>
      </div>
    </div>
  );
}
