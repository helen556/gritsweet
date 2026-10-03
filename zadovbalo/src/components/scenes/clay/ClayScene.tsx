"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { loadImage, loadJson, useSceneAssets } from "@/lib/scene/assets";
import { createHeightfield, dent, fbm, shade, smooth, smudge, type Heightfield } from "@/lib/scene/heightfield";
import { createHeightGL, type HeightGL } from "@/lib/scene/heightgl";
import { useFrameLoop } from "@/lib/scene/loop";
import { usePointer } from "@/lib/scene/pointer";
import { detectQuality } from "@/lib/scene/quality";
import { haptic, sound } from "@/lib/scene/sound";
import type { SceneProps } from "../types";

type Tool = "shape" | "smooth";

/** Світло збоку зліва, як на фото глини. */
const LIGHT: [number, number, number] = (() => {
  const v = [-0.62, -0.42, 0.66];
  const n = Math.hypot(v[0]!, v[1]!, v[2]!);
  return [v[0]! / n, v[1]! / n, v[2]! / n] as [number, number, number];
})();

async function loadClay() {
  const [meta, detail] = await Promise.all([loadJson<{ albedo: [number, number, number] }>("/scenes/clay/clay.json"), loadImage("/scenes/clay/detail.webp")]);
  return { meta, detail };
}

export default function ClayScene(props: SceneProps) {
  const assets = useSceneAssets(loadClay);
  if (assets.status === "loading") return <div role="status" className="grid h-full place-items-center text-sm text-mist">Готую глину…</div>;
  if (assets.status === "error")
    return (
      <div className="grid h-full place-items-center gap-3 px-6 text-center text-mist">
        <p>Не вдалося завантажити глину.</p>
        <button type="button" onClick={assets.retry} className="scene-btn border border-steel/60">
          Спробувати ще
        </button>
      </div>
    );
  return <Clay {...props} data={assets.data} />;
}

/** Брила глини: опукла «подушка» з заокругленими краями, як на фото, з помітними нерівностями. */
function fillBlock(hf: Heightfield, height: number) {
  const { w, h, data } = hf;
  const cx = w / 2;
  const cy = h / 2;
  const rx = w * 0.3;
  const ry = Math.min(h * 0.34, w * 0.34);
  const band = Math.max(5, Math.min(rx, ry) * 0.22); // ширина заокруглення краю, клітинки
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = Math.abs(x - cx) / rx;
      const dy = Math.abs(y - cy) / ry;
      // Суперелипс: майже квадрат із мʼякими кутами; край трохи «гуляє».
      const r = Math.pow(Math.pow(dx, 4) + Math.pow(dy, 4), 0.25) * (1 + 0.06 * (fbm(x * 0.04, y * 0.04) - 0.5));
      const dist = (1 - r) * Math.min(rx, ry); // відстань до краю в клітинках
      if (dist <= 0) {
        data[y * w + x] = 0;
        continue;
      }
      const t = Math.min(1, dist / band);
      const edge = Math.sin((t * Math.PI) / 2); // чверть кола — круглий бік без сходинок
      const crown = 1 - 0.18 * r * r;
      const lumps = 1 + 0.16 * (fbm(x * 0.035 + 3, y * 0.035) - 0.5) + 0.05 * (fbm(x * 0.12, y * 0.12 + 7) - 0.5);
      data[y * w + x] = height * edge * crown * lumps;
    }
}

function Clay({ reducedMotion, setHint, onInteract, data }: SceneProps & { data: Awaited<ReturnType<typeof loadClay>> }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("shape");
  const toolRef = useRef<Tool>("shape");
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [mode, setMode] = useState<"gl" | "fallback">("gl");
  const quality = useMemo(() => detectQuality(), []);
  // Деталізація під пристрій: менше клітинок на слабких, але освітлення попіксельне.
  const cell = quality.tier === "low" ? 3.2 : 2.4;
  const gw = Math.max(32, Math.round(size.w / cell));
  const gh = Math.max(32, Math.round(size.h / cell));
  const hf = useMemo(() => {
    const f = createHeightfield(gw, gh);
    fillBlock(f, Math.min(gw, gh) * 0.2);
    return f;
  }, [gw, gh]);
  const gl = useRef<HeightGL | null>(null);
  const dirty = useRef(true);
  const touches = useRef(new Map<number, { x: number; y: number; px: number; py: number; t0: number; hold: number; moved: number }>());

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !size.w) return;
    const r = createHeightGL(c, {
      gw: hf.w,
      gh: hf.h,
      albedo: null,
      baseColor: [data.meta.albedo[0] * 0.98, data.meta.albedo[1] * 0.98, data.meta.albedo[2]],
      detail: data.detail,
      detailScale: 1.1,
      detailStrength: 0.55,
      light: LIGHT,
      relief: 1,
      specular: 0.06,
      shininess: 24,
      solid: true,
      ao: 0.05,
    });
    if (!r) {
      setMode("fallback");
      return;
    }
    gl.current = r;
    setMode("gl");
    dirty.current = true;
    const onLost = () => setMode("fallback");
    const onRestored = () => setMode("gl");
    c.addEventListener("webglcontextlost", onLost);
    c.addEventListener("webglcontextrestored", onRestored);
    return () => {
      c.removeEventListener("webglcontextlost", onLost);
      c.removeEventListener("webglcontextrestored", onRestored);
      r.dispose();
      gl.current = null;
    };
  }, [hf, size.w, data]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !gl.current || !size.w) return;
    gl.current.resize(Math.round(size.w * quality.dpr), Math.round(size.h * quality.dpr));
    dirty.current = true;
  }, [size, quality.dpr, hf]);

  const render = useCallback(() => {
    if (!dirty.current) return;
    dirty.current = false;
    if (mode === "gl" && gl.current && !gl.current.lost()) {
      gl.current.upload(hf.data);
      gl.current.render();
      return;
    }
    // Запасний варіант без WebGL: те саме поле висот, освітлення на процесорі.
    const c = fallbackRef.current;
    if (!c) return;
    if (c.width !== hf.w) {
      c.width = hf.w;
      c.height = hf.h;
    }
    const g = c.getContext("2d");
    if (!g) return;
    const img = g.createImageData(hf.w, hf.h);
    const base = data.meta.albedo.map((v) => v * 255) as [number, number, number];
    const scaled: Heightfield = { w: hf.w, h: hf.h, data: hf.data.map((v) => v / (Math.min(gw, gh) * 0.2)), gloss: hf.gloss };
    shade(scaled, img.data, { base, grain: 0.18, specular: 0.05, shininess: 20, relief: Math.min(gw, gh) * 0.2 });
    g.putImageData(img, 0, 0);
  }, [mode, hf, data.meta.albedo, gw, gh]);

  const toGrid = (x: number, y: number) => ({ x: (x / size.w) * hf.w, y: (y / size.h) * hf.h });
  const R = Math.max(5, 22 / cell); // палець ≈ 22 css px

  const wake = useFrameLoop(rootRef, (dt) => {
    let busy = false;
    const now = performance.now();
    if (toolRef.current === "shape") {
      for (const t of touches.current.values()) {
        // Утримання на місці — вмʼятина глибшає під пальцем.
        if (t.moved < 3) {
          t.hold += dt;
          dent(hf, t.x, t.y, R * (0.8 + Math.min(0.4, t.hold * 0.2)), (reducedMotion ? 0.5 : 0.35) * Math.min(1.2, 0.25 + t.hold));
          dirty.current = true;
          busy = true;
          if (now - t.t0 > 160 && Math.random() < dt * 3) sound.play("clay", 0.3);
        }
      }
    }
    render();
    return busy || touches.current.size > 0;
  });

  useEffect(() => {
    dirty.current = true;
    render();
  }, [render, size]);

  usePointer(rootRef, {
    down: (p) => {
      onInteract();
      const g = toGrid(p.x, p.y);
      touches.current.set(p.id, { x: g.x, y: g.y, px: g.x, py: g.y, t0: performance.now(), hold: 0, moved: 0 });
      if (toolRef.current === "shape") {
        dent(hf, g.x, g.y, R * 0.8, 0.6);
        dirty.current = true;
        sound.play("clay", 0.45);
        haptic(6);
      }
      wake();
    },
    move: (p) => {
      const t = touches.current.get(p.id);
      if (!t) return;
      const g = toGrid(p.x, p.y);
      const dx = g.x - t.x;
      const dy = g.y - t.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.05) return;
      t.moved += dist;
      if (toolRef.current === "smooth") {
        const steps = Math.ceil(dist / (R * 0.5));
        for (let k = 1; k <= steps; k++) {
          smooth(hf, t.x + (dx * k) / steps, t.y + (dy * k) / steps, R * 2, 0.9);
          smooth(hf, t.x + (dx * k) / steps, t.y + (dy * k) / steps, R * 1.4, 0.9);
        }
      } else if (touches.current.size >= 2) {
        // Двома пальцями — стискати: матеріал між пальцями видавлюється в гребінь.
        smudge(hf, g.x, g.y, dx, dy, R * 1.5, 0.9);
      } else {
        // Тягнути: матеріал іде за пальцем, позаду лишається борозна.
        const steps = Math.ceil(dist / (R * 0.4));
        for (let k = 1; k <= steps; k++) {
          const x = t.x + (dx * k) / steps;
          const y = t.y + (dy * k) / steps;
          smudge(hf, x, y, dx / steps, dy / steps, R * 1.25, 0.85);
          dent(hf, x, y, R * 0.7, 0.18);
        }
      }
      t.px = t.x;
      t.py = t.y;
      t.x = g.x;
      t.y = g.y;
      dirty.current = true;
      wake();
    },
    up: (p) => {
      touches.current.delete(p.id);
      wake();
    },
  });

  const setToolBoth = (t: Tool) => {
    setTool(t);
    toolRef.current = t;
    setHint(t === "smooth" ? "Проведи по поверхні — вона поступово вирівнюється." : "Натискай і тягни. Двома пальцями можна стискати.");
  };

  /** Кнопкова альтернатива: вмʼятина в довільному місці / розгладити все. */
  const pressCenter = () => {
    onInteract();
    for (let i = 0; i < 4; i++) dent(hf, hf.w / 2 + (Math.random() - 0.5) * hf.w * 0.3, hf.h / 2 + (Math.random() - 0.5) * hf.h * 0.3, R, 1.4);
    dirty.current = true;
    sound.play("clay", 0.5);
    wake();
  };
  const smoothAll = () => {
    onInteract();
    for (let y = 4; y < hf.h; y += Math.max(3, R)) for (let x = 4; x < hf.w; x += Math.max(3, R)) smooth(hf, x, y, R * 2, 0.5);
    dirty.current = true;
    wake();
  };

  return (
    <div ref={rootRef} className="scene-surface relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} aria-hidden className={cn("absolute inset-0 h-full w-full", mode !== "gl" && "hidden")} />
      <canvas ref={fallbackRef} aria-hidden className={cn("absolute inset-0 h-full w-full", mode === "gl" && "hidden")} style={{ imageRendering: "auto" }} />
      {mode === "fallback" && <p className="absolute inset-x-0 top-2 text-center text-xs text-mist">Спрощений рендер (WebGL недоступний) — механіка та сама.</p>}
      <div className="absolute inset-x-0 bottom-1 z-10 flex flex-wrap items-center justify-center gap-2 px-2">
        <div role="radiogroup" aria-label="Інструмент" className="flex overflow-hidden rounded-[var(--radius-hair)] border border-steel/50 bg-night/70">
          {(
            [
              ["shape", "Мʼяти й тягнути"],
              ["smooth", "Розгладити"],
            ] as const
          ).map(([t, l]) => (
            <button key={t} type="button" role="radio" aria-checked={tool === t} onClick={() => setToolBoth(t)} className={cn("min-h-11 px-3 text-sm", tool === t ? "bg-frost text-abyss" : "text-frost/85 hover:bg-night")}>
              {l}
            </button>
          ))}
        </div>
        <button type="button" onClick={tool === "smooth" ? smoothAll : pressCenter} className="scene-btn border border-steel/50 bg-night/70 text-sm">
          {tool === "smooth" ? "Пригладити все" : "Натиснути"}
        </button>
      </div>
    </div>
  );
}
