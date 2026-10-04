"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fitContain, loadImage, loadJson, useSceneAssets } from "@/lib/scene/assets";
import { useCanvas2D } from "@/lib/scene/canvas";
import { useLazyRef } from "@/lib/scene/lazyRef";
import { useFrameLoop } from "@/lib/scene/loop";
import { usePointer } from "@/lib/scene/pointer";
import { haptic, sound, variant } from "@/lib/scene/sound";
import type { SceneProps } from "../types";

interface Meta {
  size: [number, number];
  radius: number;
  cells: [number, number][];
  popped: { size: number; cols: number; count: number };
  background: string;
}

/** Скільки треба тримати палець на пухирці до розриву (с). Раніше відпустив — купол повертається. */
const PRESS_TIME = 0.15;
/** Пружне повернення недотиснутого купола (с). */
const RELEASE_TAU = 0.09;
const POP_ANIM = 0.14;
const SOUNDS = ["pop-0", "pop-1", "pop-2", "pop-3"] as const;

async function loadBubble() {
  const meta = await loadJson<Meta>("/scenes/bubble/bubble.json");
  const [sheet, atlas] = await Promise.all([loadImage("/scenes/bubble/sheet.webp"), loadImage("/scenes/bubble/popped.webp")]);
  // Лопнуті латки з мʼяким круглим краєм — щоб плівка навколо лишалася тією самою.
  const S = meta.popped.size;
  const patches: HTMLCanvasElement[] = [];
  for (let i = 0; i < meta.popped.count; i++) {
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d")!;
    g.drawImage(atlas, (i % meta.popped.cols) * S, Math.floor(i / meta.popped.cols) * S, S, S, 0, 0, S, S);
    g.globalCompositeOperation = "destination-in";
    const grad = g.createRadialGradient(S / 2, S / 2, S * 0.36, S / 2, S / 2, S * 0.5);
    grad.addColorStop(0, "rgba(0,0,0,1)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    patches.push(c);
  }
  return { meta, sheet, patches };
}

export default function BubbleScene(props: SceneProps) {
  const assets = useSceneAssets(loadBubble);
  useEffect(() => sound.preload(SOUNDS), []);
  if (assets.status === "loading")
    return (
      <div role="status" className="grid h-full place-items-center text-sm text-mist">
        Розгортаю плівку…
      </div>
    );
  if (assets.status === "error")
    return (
      <div className="grid h-full place-items-center gap-3 px-6 text-center text-mist">
        <p>Не вдалося завантажити плівку.</p>
        <button type="button" onClick={assets.retry} className="scene-btn border border-steel/60">
          Спробувати ще
        </button>
      </div>
    );
  return <Bubble {...props} {...assets.data} />;
}

interface Cell {
  x: number;
  y: number;
  /** Прогин 0..1. */
  d: number;
  popped: boolean;
  /** Час після розриву (с) для короткої анімації. */
  popT: number;
  patch: number;
  rot: number;
  flip: boolean;
  /** Скільки пальців зараз на комірці. */
  touching: number;
}

function Bubble({
  meta,
  sheet,
  patches,
  reducedMotion,
  setHint,
  onInteract,
}: SceneProps & Awaited<ReturnType<typeof loadBubble>>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { canvasRef, size } = useCanvas2D();
  const [focus, setFocus] = useState(-1);
  const [poppedCount, setPoppedCount] = useState(0);
  const cells = useLazyRef<Cell[]>(() =>
    meta.cells.map(([x, y], i) => ({
      x,
      y,
      d: 0,
      popped: false,
      popT: 0,
      patch: (i * 7 + Math.floor(Math.random() * patches.length)) % patches.length,
      rot: Math.floor(Math.random() * 4) * (Math.PI / 2) + (Math.random() - 0.5) * 0.3,
      flip: Math.random() < 0.5,
      touching: 0,
    })),
  );
  /** Палець → комірка під ним. */
  const fingers = useLazyRef(() => new Map<number, { cell: number; x: number; y: number }>());
  const base = useLazyRef(() => ({ canvas: null as HTMLCanvasElement | null, key: "" }));

  const R = meta.radius;
  const view = useCallback(() => {
    const pad = Math.min(size.width, size.height) < 500 ? 6 : 24;
    return fitContain(size.width, size.height, meta.size[0], meta.size[1], pad);
  }, [size, meta.size]);

  const drawPopped = useCallback(
    (g: CanvasRenderingContext2D, c: Cell) => {
      const S = meta.popped.size;
      g.save();
      g.translate(c.x, c.y);
      g.rotate(c.rot);
      if (c.flip) g.scale(-1, 1);
      g.drawImage(patches[c.patch]!, -S / 2, -S / 2, S, S);
      g.restore();
    },
    [meta.popped.size, patches],
  );

  /** Нерухомий шар: тканина, плівка, уже лопнуті комірки. Перемальовується лише при зміні. */
  const rebuildBase = useCallback(() => {
    const { s, ox, oy } = view();
    const dpr = size.dpr;
    const key = `${size.width}x${size.height}@${dpr}`;
    let c = base.current.canvas;
    if (!c || base.current.key !== key) {
      c = document.createElement("canvas");
      c.width = Math.round(size.width * dpr);
      c.height = Math.round(size.height * dpr);
      base.current = { canvas: c, key };
    }
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = meta.background;
    g.fillRect(0, 0, size.width, size.height);
    g.save();
    g.translate(ox, oy);
    g.scale(s, s);
    // мʼяка тінь під плівкою на тканині
    g.shadowColor = "rgba(40,34,30,0.25)";
    g.shadowBlur = 18 * s;
    g.shadowOffsetY = 6 * s;
    g.drawImage(sheet, 0, 0, meta.size[0], meta.size[1]);
    g.shadowColor = "transparent";
    for (const cell of cells.current) if (cell.popped) drawPopped(g, cell);
    g.restore();
  }, [view, size, meta, sheet, cells, base, drawPopped]);

  /** Тільки одна комірка на нерухомому шарі. */
  const bakeCell = useCallback(
    (cell: Cell) => {
      const c = base.current.canvas;
      if (!c) return;
      const { s, ox, oy } = view();
      const g = c.getContext("2d")!;
      g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      g.save();
      g.translate(ox, oy);
      g.scale(s, s);
      drawPopped(g, cell);
      g.restore();
    },
    [view, size.dpr, base, drawPopped],
  );

  /** Прогнутий купол: центр «розтікається» (купол сплющується), відблиск зсувається, зʼявляється ямка. */
  const drawPressed = useCallback(
    (g: CanvasRenderingContext2D, c: Cell, d: number) => {
      const RR = R * 1.12;
      const rings = 7;
      for (let k = 0; k < rings; k++) {
        const rho = RR * (1 - k / rings);
        const m = 1 + 0.32 * d * (k / rings) ** 1.3;
        g.save();
        g.beginPath();
        g.arc(c.x, c.y, rho, 0, Math.PI * 2);
        g.clip();
        g.translate(c.x, c.y);
        g.scale(m, m * (1 - 0.05 * d));
        g.drawImage(sheet, c.x - RR, c.y - RR, RR * 2, RR * 2, -RR, -RR, RR * 2, RR * 2);
        g.restore();
      }
      // ямка під пальцем і світліший обідок натягнутої плівки
      const dim = g.createRadialGradient(c.x, c.y + R * 0.05, 0, c.x, c.y, R);
      dim.addColorStop(0, `rgba(60,55,50,${0.22 * d})`);
      dim.addColorStop(0.55, `rgba(60,55,50,${0.08 * d})`);
      dim.addColorStop(0.82, `rgba(255,255,255,${0.16 * d})`);
      dim.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = dim;
      g.beginPath();
      g.arc(c.x, c.y, R, 0, Math.PI * 2);
      g.fill();
    },
    [R, sheet],
  );

  const pop = useCallback(
    (i: number) => {
      const c = cells.current[i];
      if (!c || c.popped) return;
      c.popped = true;
      c.popT = reducedMotion ? POP_ANIM : 0;
      c.d = 1;
      bakeCell(c);
      sound.sample(variant("pop-", 4), { gain: 0.65 + Math.random() * 0.35, rate: 0.9 + Math.random() * 0.22 });
      haptic(9);
      setPoppedCount((n) => n + 1);
    },
    [cells, bakeCell, reducedMotion],
  );

  const wake = useFrameLoop(rootRef, (dt) => {
    const g = canvasRef.current?.getContext("2d");
    if (!g || !base.current.canvas) return false;
    let busy = false;
    for (let i = 0; i < cells.current.length; i++) {
      const c = cells.current[i]!;
      if (c.popped) {
        if (c.popT < POP_ANIM) {
          c.popT += dt;
          busy = true;
        }
        continue;
      }
      if (c.touching > 0) {
        c.d += dt / PRESS_TIME;
        busy = true;
        if (c.d >= 1) pop(i);
      } else if (c.d > 0.001) {
        c.d *= Math.exp(-dt / RELEASE_TAU);
        if (c.d < 0.01) c.d = 0;
        busy = true;
      }
    }
    // кадр: нерухомий шар + лише активні комірки
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(base.current.canvas, 0, 0);
    g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    const { s, ox, oy } = view();
    g.save();
    g.translate(ox, oy);
    g.scale(s, s);
    for (const c of cells.current) {
      if (!c.popped && c.d > 0.005) drawPressed(g, c, Math.min(1, c.d));
      else if (c.popped && c.popT < POP_ANIM) {
        // мить розриву: купол «падає», мембрана мнеться — прогнутий стан швидко гасне над лопнутим
        const t = c.popT / POP_ANIM;
        g.save();
        g.globalAlpha = 1 - t;
        drawPressed(g, c, 1);
        g.restore();
        const sh = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, R);
        sh.addColorStop(0, `rgba(40,36,32,${0.18 * (1 - t)})`);
        sh.addColorStop(1, "rgba(40,36,32,0)");
        g.fillStyle = sh;
        g.beginPath();
        g.arc(c.x, c.y, R, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (focus >= 0) {
      const c = cells.current[focus];
      if (c) {
        g.strokeStyle = "rgba(20,24,28,0.85)";
        g.lineWidth = 3 / s;
        g.setLineDash([6 / s, 5 / s]);
        g.beginPath();
        g.arc(c.x, c.y, R + 4, 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
      }
    }
    g.restore();
    return busy;
  });

  useEffect(() => {
    if (!size.width) return;
    rebuildBase();
    wake();
  }, [size, rebuildBase, wake]);

  useEffect(() => wake(), [focus, wake]);

  const cellAt = useCallback(
    (px: number, py: number, reach = 1) => {
      const { s, ox, oy } = view();
      const x = (px - ox) / s;
      const y = (py - oy) / s;
      let best = -1;
      let bd = (R * reach) ** 2;
      cells.current.forEach((c, i) => {
        const d = (c.x - x) ** 2 + (c.y - y) ** 2;
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      return best;
    },
    [view, R, cells],
  );

  const setFinger = useCallback(
    (id: number, cell: number) => {
      const f = fingers.current.get(id);
      const prev = f?.cell ?? -1;
      if (prev === cell) return;
      if (prev >= 0) cells.current[prev]!.touching--;
      if (cell >= 0) cells.current[cell]!.touching++;
    },
    [fingers, cells],
  );

  usePointer(rootRef, {
    down: (p) => {
      onInteract();
      const i = cellAt(p.x, p.y);
      setFinger(p.id, i);
      fingers.current.set(p.id, { cell: i, x: p.x, y: p.y });
      wake();
    },
    move: (p) => {
      const f = fingers.current.get(p.id);
      if (!f) return;
      // Ведення пальцем: комірки, повз центр яких пройшов палець, прогинаються сильніше.
      const steps = Math.max(1, Math.ceil(Math.hypot(p.x - f.x, p.y - f.y) / 6));
      const passed = new Set<number>();
      for (let k = 1; k <= steps; k++) {
        const j = cellAt(f.x + ((p.x - f.x) * k) / steps, f.y + ((p.y - f.y) * k) / steps, 0.45);
        if (j >= 0) passed.add(j);
      }
      for (const j of passed) {
        const c = cells.current[j]!;
        if (!c.popped && j !== f.cell) c.d = Math.min(0.999, c.d + 0.45);
      }
      const i = cellAt(p.x, p.y);
      setFinger(p.id, i);
      fingers.current.set(p.id, { cell: i, x: p.x, y: p.y });
      wake();
    },
    up: (p) => {
      // і відпускання, і pointercancel: купол просто повертається (недотиснутий не лопає)
      setFinger(p.id, -1);
      fingers.current.delete(p.id);
      wake();
    },
  });

  // Розрив дійшов до лічильника — підказки міняються мʼяко, без балів і рахунку.
  useEffect(() => {
    if (poppedCount === 1) setHint("Можна вести пальцем по сусідніх пухирцях.");
    if (poppedCount > 0 && poppedCount === cells.current.length) setHint("Уся плівка сплющена. «Нова плівка» — угорі.");
  }, [poppedCount, setHint, cells]);

  /** Клавіатура: стрілки — вибір пухирця, Enter/пробіл — натиснути. */
  const onKey = (e: React.KeyboardEvent) => {
    const list = cells.current;
    const cur = focus >= 0 ? focus : list.findIndex((c) => !c.popped);
    const c = list[cur];
    if (!c) return;
    const dir: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (dir[e.key]) {
      e.preventDefault();
      const [dx, dy] = dir[e.key]!;
      let best = cur;
      let bd = Infinity;
      list.forEach((o, i) => {
        const vx = o.x - c.x;
        const vy = o.y - c.y;
        const along = vx * dx + vy * dy;
        if (along < R) return;
        const d = along + Math.abs(vx * dy + vy * dx) * 2;
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      setFocus(best);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onInteract();
      pressBriefly(cur);
      setFocus(cur);
    }
  };

  /** Альтернатива жесту: купол прогинається й лопає послідовно, як від пальця. */
  const pressBriefly = (i: number) => {
    const c = cells.current[i];
    if (!c || c.popped) return;
    c.touching++;
    wake();
    window.setTimeout(() => {
      c.touching = Math.max(0, c.touching - 1);
      if (!c.popped) pop(i);
      wake();
    }, PRESS_TIME * 1000 + 30);
  };

  const popNext = () => {
    onInteract();
    const list = cells.current;
    const free = list.map((c, i) => (c.popped ? -1 : i)).filter((i) => i >= 0);
    if (!free.length) return;
    pressBriefly(free[Math.floor(Math.random() * free.length)]!);
  };

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKey}
      onFocus={() => focus < 0 && setFocus(cells.current.findIndex((c) => !c.popped))}
      onBlur={() => setFocus(-1)}
      aria-label="Пакувальна плівка. Стрілки — вибрати пухирець, Enter — лопнути."
      className="scene-surface relative h-full w-full overflow-hidden outline-none"
      style={{ background: meta.background, touchAction: "none" }}
    >
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-x-0 bottom-1 z-10 flex justify-center px-2">
        <button type="button" onClick={popNext} className="scene-btn border border-steel/50 bg-night/75 text-sm text-frost">
          Лопнути пухирець
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {poppedCount > 0 ? `Лопнуто пухирців: ${poppedCount}` : ""}
      </span>
    </div>
  );
}
