"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { createHeightfield, dent, fillLump, shade, smooth, smudge, squeeze, type Heightfield, type Material } from "@/lib/scene/heightfield";
import { useFrameLoop } from "@/lib/scene/loop";
import { bindPointer } from "@/lib/scene/pointer";
import { detectQuality } from "@/lib/scene/quality";
import { haptic, sound } from "@/lib/scene/sound";
import type { SceneProps } from "../types";

type Tool = "knead" | "smooth";

const CLAY: Material = { base: [164, 170, 172], grain: 0.06, specular: 0.05, shininess: 22, relief: 95 };

interface Touch {
  x: number;
  y: number;
  gx: number;
  gy: number;
  pressure: number;
  still: number;
}

export default function ClayScene({ intensity, setHint, onSettled }: SceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const clayRef = useRef<HTMLCanvasElement>(null);
  const shadowRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("knead");
  const [failed, setFailed] = useState(false);
  const toolRef = useRef(tool);
  const intensityRef = useRef(intensity);
  useEffect(() => {
    toolRef.current = tool;
    intensityRef.current = intensity;
  });

  const st = useRef<{
    hf: Heightfield;
    off: HTMLCanvasElement;
    offShadow: HTMLCanvasElement;
    img: ImageData;
    imgShadow: ImageData;
    rect: { x: number; y: number; size: number };
    touches: Map<number, Touch>;
    dirty: boolean;
    actions: number;
    lastSound: number;
  } | null>(null);

  // Ініціалізація поля й офскрін-буферів.
  useEffect(() => {
    const n = detectQuality().tier === "low" ? 168 : 256;
    const hf = createHeightfield(n, n);
    fillLump(hf, 1.7, 1);
    const off = document.createElement("canvas");
    off.width = off.height = n;
    const offShadow = document.createElement("canvas");
    offShadow.width = offShadow.height = n;
    const octx = off.getContext("2d");
    if (!octx) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- немає 2D-контексту: спрощений варіант
      setFailed(true);
      return;
    }
    st.current = {
      hf,
      off,
      offShadow,
      img: octx.createImageData(n, n),
      imgShadow: octx.createImageData(n, n),
      rect: { x: 0, y: 0, size: 1 },
      touches: new Map(),
      dirty: true,
      actions: 0,
      lastSound: 0,
    };
  }, []);

  const layout = () => {
    const s = st.current;
    const root = rootRef.current;
    if (!s || !root) return;
    const w = root.clientWidth;
    const h = root.clientHeight;
    const size = Math.min(w * 0.96, h * 0.9, 640);
    s.rect = { x: (w - size) / 2, y: (h - size) / 2, size };
    const dpr = detectQuality().dpr;
    for (const c of [clayRef.current, shadowRef.current]) {
      if (!c) continue;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    s.dirty = true;
  };

  const draw = () => {
    const s = st.current;
    const c = clayRef.current?.getContext("2d");
    const sc = shadowRef.current?.getContext("2d");
    if (!s || !c) return;
    shade(s.hf, s.img.data, CLAY, s.imgShadow.data);
    s.off.getContext("2d")!.putImageData(s.img, 0, 0);
    s.offShadow.getContext("2d")!.putImageData(s.imgShadow, 0, 0);
    const { x, y, size } = s.rect;
    c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    c.drawImage(s.off, x, y, size, size);
    if (sc) {
      sc.clearRect(0, 0, sc.canvas.width, sc.canvas.height);
      sc.drawImage(s.offShadow, x + size * 0.03, y + size * 0.06, size, size);
    }
  };

  const toGrid = (px: number, py: number) => {
    const s = st.current!;
    return { gx: ((px - s.rect.x) / s.rect.size) * s.hf.w, gy: ((py - s.rect.y) / s.rect.size) * s.hf.h };
  };

  const wake = useFrameLoop(rootRef, (dt) => {
    const s = st.current;
    if (!s) return false;
    const k = intensityRef.current;
    // Утримання пальця поглиблює вмʼятину (тиск накопичується).
    for (const t of s.touches.values()) {
      if (toolRef.current === "knead") {
        t.still += dt;
        const r = s.hf.w * (0.035 + 0.012 * k);
        dent(s.hf, t.gx, t.gy, r, dt * (0.18 + 0.12 * k) * (0.6 + t.pressure) * Math.min(1, 0.3 + t.still));
      } else smooth(s.hf, t.gx, t.gy, s.hf.w * 0.07, 0.35);
      s.dirty = true;
      if (performance.now() - s.lastSound > 380) {
        s.lastSound = performance.now();
        sound.play("clay", 0.25 + 0.15 * k);
      }
    }
    if (s.dirty) {
      draw();
      s.dirty = false;
    }
    return s.touches.size > 0;
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !st.current) return;
    layout();
    draw();
    const ro = new ResizeObserver(() => {
      layout();
      wake();
    });
    ro.observe(root);
    const unbind = bindPointer(root, {
      down: (p) => {
        const s = st.current;
        if (!s) return false;
        const { gx, gy } = toGrid(p.x, p.y);
        const i = Math.floor(gy) * s.hf.w + Math.floor(gx);
        if (gx < 0 || gy < 0 || gx >= s.hf.w || gy >= s.hf.h || (s.hf.data[i] ?? 0) < 0.02) return false; // повз глину
        s.touches.set(p.id, { x: p.x, y: p.y, gx, gy, pressure: p.pressure, still: 0 });
        sound.play("clay", 0.4);
        haptic(10);
        s.actions++;
        if (s.actions === 1) setHint("Тримай довше — вмʼятина глибшає. Тягни — глина піде за пальцем.");
        if (s.actions === 8) setHint("Двома пальцями можна стиснути. «Розгладити» — щоб вирівняти.");
        if (s.actions === 14) onSettled();
        wake();
      },
      move: (p) => {
        const s = st.current;
        const t = s?.touches.get(p.id);
        if (!s || !t) return;
        const { gx, gy } = toGrid(p.x, p.y);
        const dx = gx - t.gx;
        const dy = gy - t.gy;
        if (Math.hypot(dx, dy) < 0.15) return;
        const k = intensityRef.current;
        if (toolRef.current === "knead") smudge(s.hf, gx, gy, dx, dy, s.hf.w * (0.045 + 0.01 * k), 0.85);
        else smooth(s.hf, gx, gy, s.hf.w * 0.08, 0.6);
        t.gx = gx;
        t.gy = gy;
        t.pressure = p.pressure;
        t.still = 0;
        s.dirty = true;
        wake();
      },
      up: (p) => {
        st.current?.touches.delete(p.id);
      },
    });
    return () => {
      ro.disconnect();
      unbind();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- привʼязка один раз; свіжі значення через refs
  }, [failed]);

  // Кнопки — доступна альтернатива жестам.
  const act = (fn: (hf: Heightfield) => void) => {
    const s = st.current;
    if (!s) return;
    fn(s.hf);
    s.dirty = true;
    s.actions++;
    sound.play("clay", 0.5);
    wake();
  };
  const press = () =>
    act((hf) => {
      const a = Math.random() * Math.PI * 2;
      const r = hf.w * 0.12 * Math.random();
      for (let i = 0; i < 6; i++) dent(hf, hf.w / 2 + Math.cos(a) * r, hf.h / 2 + Math.sin(a) * r, hf.w * 0.06, 0.12 + 0.05 * intensity);
    });

  if (failed) {
    return <div className="grid h-full place-items-center px-6 text-center text-mist">Цей пристрій не показує глину. Спробуй іншу дію.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={rootRef} className="scene-surface relative min-h-0 flex-1 cursor-pointer">
        {/* Освітлена поверхня столу */}
        <div aria-hidden className="pointer-events-none absolute inset-x-[8%] bottom-[6%] top-[30%] rounded-[50%] bg-[radial-gradient(closest-side,rgb(86_116_135/0.28),transparent)]" />
        <canvas ref={shadowRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-80 [filter:blur(16px)]" />
        <canvas ref={clayRef} role="img" aria-label="Шматок глини. Натискай, тягни, розгладжуй." className="absolute inset-0 h-full w-full" />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 px-3 pt-2">
        <div role="radiogroup" aria-label="Інструмент" className="flex overflow-hidden rounded-[var(--radius-hair)] border border-steel/50">
          {(
            [
              ["knead", "Мʼяти"],
              ["smooth", "Розгладити"],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={tool === v} onClick={() => setTool(v)} className={cn("min-h-11 px-3 text-sm", tool === v ? "bg-frost text-abyss" : "text-frost/80 hover:bg-night")}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="scene-btn border border-steel/50" onClick={press}>
          Натиснути
        </button>
        <button type="button" className="scene-btn border border-steel/50" onClick={() => act((hf) => squeeze(hf, "x", 0.06))}>
          Стиснути
        </button>
        <button type="button" className="scene-btn border border-steel/50" onClick={() => act((hf) => squeeze(hf, "x", -0.05))}>
          Розтягнути
        </button>
        <button
          type="button"
          className="scene-btn border border-steel/50"
          onClick={() =>
            act((hf) => {
              for (let y = 6; y < hf.h; y += 10) for (let x = 6; x < hf.w; x += 10) smooth(hf, x, y, 9, 0.7);
            })
          }
        >
          Розгладити все
        </button>
      </div>
    </div>
  );
}
