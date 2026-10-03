"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { createHeightfield, dent, hash2, relax, shade, type Heightfield, type Material } from "@/lib/scene/heightfield";
import { useFrameLoop } from "@/lib/scene/loop";
import { bindPointer } from "@/lib/scene/pointer";
import { detectQuality } from "@/lib/scene/quality";
import { haptic, sound } from "@/lib/scene/sound";
import type { SceneProps } from "../types";

const SAND: Material = { base: [184, 182, 172], grain: 0.16, specular: 0.02, shininess: 12, relief: 60 };
const TALUS = 0.045;

interface Stone {
  x: number;
  y: number;
  r: number;
  ry: number;
  rot: number;
  tone: number;
}
interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}
interface Ring {
  x: number;
  y: number;
  t: number;
}

export default function SandScene({ reducedMotion, setHint }: SceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sandRef = useRef<HTMLCanvasElement>(null);
  const waterRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [flow, setFlow] = useState(true);
  const flowRef = useRef(flow);
  useEffect(() => {
    flowRef.current = flow;
  });

  const st = useRef({
    hf: null as Heightfield | null,
    wet: new Float32Array(0),
    off: null as HTMLCanvasElement | null,
    img: null as ImageData | null,
    w: 1,
    h: 1,
    dpr: 1,
    cell: 1,
    stones: [] as Stone[],
    drops: [] as Drop[],
    rings: [] as Ring[],
    gesture: null as null | { pointer: number; kind: "draw" | "stone"; stone?: Stone; last: { x: number; y: number }; moved: number; start: { x: number; y: number } },
    slump: { x0: 0, y0: 0, x1: 0, y1: 0, t: 0 },
    sandDirty: true,
    frame: 0,
    source: { x: 0, y: 0 },
    spawnAcc: 0,
    maxDrops: 240,
    wetAt: 0,
  });

  const init = () => {
    const s = st.current;
    const root = rootRef.current!;
    s.w = root.clientWidth;
    s.h = root.clientHeight;
    s.dpr = detectQuality().dpr;
    const low = detectQuality().tier === "low";
    const gw = low ? 120 : 170;
    const gh = Math.max(40, Math.round((gw * s.h) / s.w));
    s.cell = s.w / gw;
    s.maxDrops = low ? 140 : 240;
    const hf = createHeightfield(gw, gh);
    for (let y = 0; y < gh; y++)
      for (let x = 0; x < gw; x++) {
        // Пологий схил донизу + вітрові брижі.
        hf.data[y * gw + x] = 1.4 - (y / gh) * 0.5 + 0.0035 * Math.sin(x * 0.32 + Math.sin(y * 0.12) * 2.5) + (hash2(x, y) - 0.5) * 0.003;
      }
    s.hf = hf;
    s.wet = new Float32Array(gw * gh);
    s.off = document.createElement("canvas");
    s.off.width = gw;
    s.off.height = gh;
    s.img = s.off.getContext("2d")!.createImageData(gw, gh);
    s.stones = Array.from({ length: 5 }, (_, i) => ({
      x: s.w * (0.18 + 0.64 * hash2(i, 11)),
      y: s.h * (0.3 + 0.55 * hash2(i, 12)),
      r: 14 + hash2(i, 13) * 14,
      ry: 0.72 + hash2(i, 14) * 0.2,
      rot: hash2(i, 15) * Math.PI,
      tone: hash2(i, 16),
    }));
    s.source = { x: s.w * 0.3, y: -6 };
    s.sandDirty = true;
  };

  const gridOf = (x: number, y: number) => ({ gx: x / st.current.cell, gy: y / st.current.cell });

  const heightAt = (x: number, y: number) => {
    const s = st.current;
    const hf = s.hf!;
    const gx = Math.max(0, Math.min(hf.w - 1, Math.round(x / s.cell)));
    const gy = Math.max(0, Math.min(hf.h - 1, Math.round(y / s.cell)));
    return hf.data[gy * hf.w + gx]!;
  };

  const markSlump = (gx: number, gy: number, r: number) => {
    const sl = st.current.slump;
    if (sl.t <= 0) {
      Object.assign(sl, { x0: gx - r, y0: gy - r, x1: gx + r, y1: gy + r });
    } else {
      sl.x0 = Math.min(sl.x0, gx - r);
      sl.y0 = Math.min(sl.y0, gy - r);
      sl.x1 = Math.max(sl.x1, gx + r);
      sl.y1 = Math.max(sl.y1, gy + r);
    }
    sl.t = 1.6; // секунди осипання після жесту
  };

  const plow = (x: number, y: number, r: number, amount: number) => {
    const s = st.current;
    const { gx, gy } = gridOf(x, y);
    dent(s.hf!, gx, gy, r / s.cell, amount);
    markSlump(gx, gy, (r / s.cell) * 3);
    s.sandDirty = true;
  };

  const drawSand = () => {
    const s = st.current;
    const ctx = sandRef.current?.getContext("2d");
    if (!ctx || !s.hf || !s.img || !s.off) return;
    shade(s.hf, s.img.data, SAND, undefined, s.wet);
    s.off.getContext("2d")!.putImageData(s.img, 0, 0);
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(s.off, 0, 0, s.w, s.h);
    // Камінці: тінь, тіло, відблиск.
    for (const k of s.stones) {
      ctx.save();
      ctx.translate(k.x, k.y);
      ctx.rotate(k.rot);
      ctx.fillStyle = "rgba(20,25,28,0.45)";
      ctx.filter = "blur(4px)";
      ctx.beginPath();
      ctx.ellipse(4, 6, k.r * 1.05, k.r * k.ry * 1.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.filter = "none";
      // Матовий камінь: мʼяке світло без дзеркального блиску + крапчаста фактура.
      const g = ctx.createRadialGradient(-k.r * 0.3, -k.r * 0.35, k.r * 0.2, 0, 0, k.r * 1.15);
      const base = 92 + k.tone * 36;
      g.addColorStop(0, `rgb(${base + 34},${base + 38},${base + 40})`);
      g.addColorStop(0.7, `rgb(${base},${base + 4},${base + 8})`);
      g.addColorStop(1, `rgb(${base - 34},${base - 30},${base - 26})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, k.r, k.r * k.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.clip();
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.12)";
        ctx.fillRect((hash2(i, k.tone * 99) - 0.5) * k.r * 2, (hash2(k.tone * 77, i) - 0.5) * k.r * 2, 1.4, 1.4);
      }
      ctx.restore();
      ctx.restore();
    }
  };

  const drawWater = () => {
    const s = st.current;
    const ctx = waterRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, s.w, s.h);
    for (const d of s.drops) {
      const g = ctx.createRadialGradient(d.x - 1, d.y - 1, 0, d.x, d.y, 10);
      g.addColorStop(0, "rgba(196,224,230,0.75)");
      g.addColorStop(0.4, "rgba(120,170,182,0.45)");
      g.addColorStop(1, "rgba(110,154,156,0)");
      ctx.fillStyle = g;
      ctx.fillRect(d.x - 10, d.y - 10, 20, 20);
    }
    // Кола від дотику.
    for (const r of s.rings) {
      const rad = 6 + r.t * 70;
      ctx.strokeStyle = `rgba(226,238,242,${0.7 * (1 - r.t)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, rad, rad * 0.8, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (r.t > 0.15) {
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, rad * 0.6, rad * 0.48, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  };

  const wake = useFrameLoop(rootRef, (dt) => {
    const s = st.current;
    const hf = s.hf;
    if (!hf) return false;
    s.frame++;
    // Осипання після жесту.
    if (s.slump.t > 0) {
      s.slump.t -= dt;
      for (let k = 0; k < 2; k++) if (relax(hf, s.slump.x0, s.slump.y0, s.slump.x1, s.slump.y1, TALUS, 0.18)) s.sandDirty = true;
    }
    // Струмок.
    if (flowRef.current && s.drops.length < s.maxDrops) {
      s.spawnAcc += dt * 60;
      while (s.spawnAcc > 1) {
        s.spawnAcc -= 1;
        s.drops.push({ x: s.source.x + (Math.random() - 0.5) * 10, y: s.source.y, vx: (Math.random() - 0.5) * 10, vy: 40, life: 0 });
      }
    }
    const e = s.cell * 1.5;
    for (const d of s.drops) {
      // Вода тече вниз за рельєфом (градієнт висоти) + легкий ухил кадру донизу.
      const gx = (heightAt(d.x - e, d.y) - heightAt(d.x + e, d.y)) / (2 * e);
      const gy = (heightAt(d.x, d.y - e) - heightAt(d.x, d.y + e)) / (2 * e);
      // Сила схилу: перепади висот на піксель малі, тому масштаб великий; борозни ведуть воду.
      d.vx += gx * 300000 * dt;
      d.vy += (gy * 300000 + 30) * dt;
      const damp = Math.pow(0.08, dt);
      d.vx *= damp;
      d.vy *= damp;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.life += dt;
      // Огинає камінці.
      for (const k of s.stones) {
        const dx = d.x - k.x;
        const dy = d.y - k.y;
        const dist = Math.hypot(dx, dy);
        const rr = k.r + 3;
        if (dist < rr) {
          const nx = dx / (dist || 1);
          const ny = dy / (dist || 1);
          d.x = k.x + nx * rr;
          d.y = k.y + ny * rr;
          const vn = d.vx * nx + d.vy * ny;
          if (vn < 0) {
            d.vx -= vn * nx;
            d.vy -= vn * ny;
          }
        }
      }
      // Мокрий слід.
      const cx = Math.floor(d.x / s.cell);
      const cy = Math.floor(d.y / s.cell);
      if (cx >= 0 && cy >= 0 && cx < hf.w && cy < hf.h) s.wet[cy * hf.w + cx] = Math.min(1, s.wet[cy * hf.w + cx]! + 0.05);
    }
    s.drops = s.drops.filter((d) => d.y < s.h + 10 && d.x > -10 && d.x < s.w + 10 && d.life < 18);
    // Мокре повільно висихає.
    if (s.frame % 6 === 0) {
      for (let i = 0; i < s.wet.length; i++) s.wet[i] = s.wet[i]! * 0.985;
      s.sandDirty = true;
    }
    for (const r of s.rings) r.t += dt * (reducedMotion ? 2 : 0.7);
    s.rings = s.rings.filter((r) => r.t < 1);
    if (s.sandDirty && (s.gesture || s.slump.t > 0 || s.frame % 3 === 0)) {
      drawSand();
      s.sandDirty = false;
    }
    drawWater();
    return s.drops.length > 0 || s.rings.length > 0 || s.slump.t > 0 || Boolean(s.gesture) || flowRef.current;
  });

  useEffect(() => {
    const root = rootRef.current;
    const a = sandRef.current;
    const b = waterRef.current;
    if (!root || !a || !b || !a.getContext("2d")) {
      setFailed(true);
      return;
    }
    const s = st.current;
    const resize = () => {
      if (!s.hf) init();
      else {
        // Поворот/ресайз: розтягуємо поле на новий розмір, нічого не скидаючи.
        const sx = root.clientWidth / s.w;
        const sy = root.clientHeight / s.h;
        for (const k of s.stones) {
          k.x *= sx;
          k.y *= sy;
        }
        s.w = root.clientWidth;
        s.h = root.clientHeight;
        s.cell = s.w / s.hf.w;
        s.source = { x: s.w * 0.3, y: -6 };
        s.sandDirty = true;
      }
      for (const c of [a, b]) {
        c.width = Math.round(s.w * s.dpr);
        c.height = Math.round(s.h * s.dpr);
      }
      drawSand();
      wake();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(root);
    const unbind = bindPointer(root, {
      down: (p) => {
        const stone = s.stones.find((k) => Math.hypot(p.x - k.x, (p.y - k.y) / k.ry) < k.r + 8);
        s.gesture = { pointer: p.id, kind: stone ? "stone" : "draw", stone, last: p, moved: 0, start: p };
        if (stone) {
          s.stones = [...s.stones.filter((k) => k !== stone), stone];
          sound.play("thud", 0.25);
        }
        wake();
      },
      move: (p) => {
        const g = s.gesture;
        if (!g || g.pointer !== p.id) return;
        const dx = p.x - g.last.x;
        const dy = p.y - g.last.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 2) return;
        g.moved = Math.max(g.moved, Math.hypot(p.x - g.start.x, p.y - g.start.y));
        // Рівномірні кроки вздовж руху — борозна без пропусків.
        const steps = Math.ceil(dist / 4);
        for (let k = 1; k <= steps; k++) {
          const x = g.last.x + (dx * k) / steps;
          const y = g.last.y + (dy * k) / steps;
          if (g.kind === "stone" && g.stone) {
            g.stone.x = x;
            g.stone.y = y;
            plow(x, y, g.stone.r * 0.8, 0.012);
          } else plow(x, y, 12, 0.03);
        }
        if (Math.random() < 0.15) sound.play("soft", 0.08);
        g.last = p;
        wake();
      },
      up: (p) => {
        const g = s.gesture;
        if (g && g.kind === "draw" && g.moved < 6) {
          // Дотик без руху — кола.
          s.rings.push({ x: p.x, y: p.y, t: 0 });
          for (const d of s.drops) {
            const dx = d.x - p.x;
            const dy = d.y - p.y;
            const dd = Math.hypot(dx, dy);
            if (dd < 80) {
              d.vx += (dx / (dd || 1)) * 60;
              d.vy += (dy / (dd || 1)) * 60;
            }
          }
          sound.play("water", 0.4);
          haptic(5);
        }
        s.gesture = null;
        wake();
      },
    });
    setHint("Веди пальцем по піску. Камінці можна пересувати. Вода знайде дорогу сама.");
    return () => {
      ro.disconnect();
      unbind();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- привʼязка один раз
  }, []);

  /** Клавіатура: провести борозну / кинути камінець у воду. */
  const furrow = () => {
    const s = st.current;
    const y0 = s.h * (0.3 + Math.random() * 0.4);
    for (let x = s.w * 0.1; x < s.w * 0.9; x += 4) plow(x, y0 + Math.sin(x / 40) * 20, 12, 0.03);
    sound.play("soft", 0.2);
    wake();
  };
  const ripple = () => {
    const s = st.current;
    s.rings.push({ x: s.w * (0.3 + Math.random() * 0.4), y: s.h * (0.4 + Math.random() * 0.3), t: 0 });
    sound.play("water", 0.4);
    wake();
  };

  if (failed) return <div className="grid h-full place-items-center px-6 text-center text-mist">Цей пристрій не показує сцену. Спробуй іншу дію.</div>;

  return (
    <div className="flex h-full flex-col">
      <div ref={rootRef} className="scene-surface relative min-h-0 flex-1 overflow-hidden">
        <canvas ref={sandRef} role="img" aria-label="Пісок із камінцями й струмком. Веди пальцем, пересувай камінці." className="absolute inset-0 h-full w-full" />
        <canvas ref={waterRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full [filter:blur(1.5px)]" />
      </div>
      <div className="flex flex-wrap justify-center gap-2 px-3 pt-2">
        <button type="button" role="switch" aria-checked={flow} className={cn("scene-btn border", flow ? "border-frost bg-frost text-abyss hover:bg-white hover:text-abyss" : "border-steel/50")} onClick={() => {
          setFlow((v) => !v);
          wake();
        }}>
          Струмок
        </button>
        <button type="button" className="scene-btn border border-steel/50" onClick={furrow}>
          Провести борозну
        </button>
        <button type="button" className="scene-btn border border-steel/50" onClick={ripple}>
          Кола на воді
        </button>
      </div>
    </div>
  );
}
