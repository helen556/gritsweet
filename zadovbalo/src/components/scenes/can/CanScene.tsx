"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadImage, loadJson, useSceneAssets } from "@/lib/scene/assets";
import { useCanvas2D } from "@/lib/scene/canvas";
import { useLazyRef } from "@/lib/scene/lazyRef";
import { useFrameLoop } from "@/lib/scene/loop";
import { usePointer } from "@/lib/scene/pointer";
import { haptic, sound } from "@/lib/scene/sound";
import type { SceneProps } from "../types";

interface Meta {
  size: [number, number];
  rivet: [number, number];
  tab: { x: number; y: number; w: number; h: number; ringTip: [number, number] };
  flap: [number, number][];
  hinge: [[number, number], [number, number]];
  lid: { cx: number; cy: number; rx: number; ry: number };
  background: string;
}

/** Нахил кришки: відношення осей еліпса (ry/rx) і косинус кута огляду. */
const SOUNDS = ["can-click", "can-hiss"] as const;
/** Поріг, після якого клапан продавлюється (рад). До нього кільце пружно повертається. */
const OPEN_AT = 0.62;
const MAX_LIFT = 1.2;
/** Скільки px кадру треба протягнути вгору на радіан підйому. */
const PX_PER_RAD = 72;

async function loadCan() {
  const meta = await loadJson<Meta>("/scenes/can/can.json");
  const [can, tab] = await Promise.all([loadImage("/scenes/can/can.webp"), loadImage("/scenes/can/tab.webp")]);
  return { meta, can, tab };
}

export default function CanScene(props: SceneProps) {
  const assets = useSceneAssets(loadCan);
  useEffect(() => sound.preload(SOUNDS), []);
  if (assets.status === "loading")
    return (
      <div role="status" className="grid h-full place-items-center text-sm text-mist">
        Дістаю банку…
      </div>
    );
  if (assets.status === "error")
    return (
      <div className="grid h-full place-items-center gap-3 px-6 text-center text-mist">
        <p>Не вдалося завантажити сцену.</p>
        <button type="button" onClick={assets.retry} className="scene-btn border border-steel/60">
          Спробувати ще
        </button>
      </div>
    );
  return <Can {...props} {...assets.data} />;
}

function Can({ meta, can, tab, setHint, onInteract, onSettled, reducedMotion }: SceneProps & Awaited<ReturnType<typeof loadCan>>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { canvasRef, size } = useCanvas2D();
  const [opened, setOpened] = useState(false);
  const k = meta.lid.ry / meta.lid.rx;
  const cosE = Math.sqrt(1 - k * k);
  const st = useLazyRef(() => ({
    lift: 0,
    vel: 0,
    open: 0,
    opened: false,
    grab: null as null | { id: number; y0: number; lift0: number },
    auto: null as null | { t: number },
    hiss: 0,
    bubbles: [] as { x: number; y: number; r: number; life: number; age: number }[],
  }));

  const view = useCallback(() => {
    const [w, h] = meta.size;
    const portrait = size.width / size.height < (w / h) * 1.2;
    // кришку тримаємо у верхній третині: великий, зручний для пальця план
    const s = portrait ? Math.max(size.width / w, size.height / h) * 1.15 : size.height / h;
    const ox = (size.width - w * s) / 2;
    const oy = portrait ? Math.min(0, size.height * 0.04 - (meta.lid.cy - meta.lid.ry * 1.6) * s) : (size.height - h * s) / 2;
    return { s, ox, oy };
  }, [size, meta.size, meta.lid]);

  /** Видимий підйом кільця: обертання навколо заклепки в похилій площині кришки = розтяг по вертикалі від заклепки. */
  const stretch = useCallback((a: number) => Math.cos(a) + (cosE / k) * Math.sin(a), [cosE, k]);

  const openNow = useCallback(() => {
    const s = st.current;
    if (s.opened) return;
    s.opened = true;
    s.hiss = 1.6;
    // клац, потім коротке «пш-ш» — один раз на банку
    sound.sample("can-click", { gain: 0.8 });
    sound.sample("can-hiss", { gain: 0.55, at: 0.05 });
    haptic(14);
    setOpened(true);
    setHint("Банка відкрита. Можна просто посидіти.");
    onSettled();
  }, [st, setHint, onSettled]);

  const flapPath = useCallback(
    (g: CanvasRenderingContext2D) => {
      // гладкий надріз: квадратичні криві через середини сторін
      const pts = meta.flap;
      const n = pts.length;
      const mid = (i: number) => {
        const a = pts[i % n]!;
        const b = pts[(i + 1) % n]!;
        return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
      };
      g.beginPath();
      const m0 = mid(0);
      g.moveTo(m0[0], m0[1]);
      for (let i = 1; i <= n; i++) {
        const c = pts[i % n]!;
        const m = mid(i);
        g.quadraticCurveTo(c[0], c[1], m[0], m[1]);
      }
      g.closePath();
    },
    [meta.flap],
  );

  const wake = useFrameLoop(rootRef, (dt) => {
    const g = canvasRef.current?.getContext("2d");
    if (!g || !size.width) return false;
    const s = st.current;
    let busy = false;
    if (s.auto) {
      busy = true;
      s.auto.t += dt;
      const t = s.auto.t;
      // кнопка: та сама послідовна дія — підняти, продавити, опустити
      s.lift = t < 0.7 ? 0.85 * Math.sin((t / 0.7) * (Math.PI / 2)) : Math.max(0.18, 0.85 - (t - 0.7) * 1.4);
      if (t > 1.2) s.auto = null;
    } else if (!s.grab) {
      // до порога кільце пружно повертається; після відкриття лишається, де відпустили
      const target = s.opened ? Math.min(s.lift, 0.9) : 0;
      const prev = s.lift;
      s.lift += (target - s.lift) * Math.min(1, dt * 10);
      if (Math.abs(s.lift - prev) > 1e-4) busy = true;
    }
    if (!s.opened && s.lift >= OPEN_AT) openNow();
    if (s.opened && s.open < 1) {
      s.open = Math.min(1, s.open + dt / (reducedMotion ? 0.05 : 0.22));
      busy = true;
    }
    if (s.hiss > 0) {
      s.hiss -= dt;
      busy = true;
      if (!reducedMotion && Math.random() < dt * 40) {
        const [[hx0, hy], [hx1]] = meta.hinge;
        s.bubbles.push({ x: hx0 + Math.random() * (hx1 - hx0), y: hy + 10 + Math.random() * 38, r: 0.8 + Math.random() * 2.2, life: 0.4 + Math.random() * 0.8, age: 0 });
      }
    }
    for (const b of s.bubbles) {
      b.age += dt;
      b.y -= 6 * dt;
    }
    s.bubbles = s.bubbles.filter((b) => b.age < b.life);
    if (s.bubbles.length) busy = true;

    const { s: sc, ox, oy } = view();
    g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    g.fillStyle = meta.background;
    g.fillRect(0, 0, size.width, size.height);
    g.save();
    g.translate(ox, oy);
    g.scale(sc, sc);
    const [w, h] = meta.size;
    g.drawImage(can, 0, 0, w, h);
    // широкий екран: краї фото мʼяко переходять у тло того ж кольору
    if (ox > 0) {
      for (const side of [0, 1]) {
        const x0 = side ? w - 60 : 60;
        const gr = g.createLinearGradient(x0, 0, side ? w : 0, 0);
        gr.addColorStop(0, `${meta.background}00`);
        gr.addColorStop(1, meta.background);
        g.fillStyle = gr;
        g.fillRect(side ? w - 60 : 0, 0, 60, h);
      }
    }

    const [rx, ry] = meta.rivet;
    const a = s.lift;
    const S = stretch(a);
    const hingeY = (meta.hinge[0][1] + meta.hinge[1][1]) / 2;

    // --- отвір і клапан ---
    if (s.open > 0) {
      g.save();
      flapPath(g);
      g.clip();
      // темна глибина з газованим напоєм
      const dg = g.createLinearGradient(0, hingeY, 0, hingeY + 55);
      dg.addColorStop(0, "#050302");
      dg.addColorStop(1, "#1d0d08");
      g.fillStyle = dg;
      g.fillRect(180, hingeY - 10, 160, 70);
      // клапан повертається на шарнірі всередину: коротшає й темнішає
      g.save();
      g.translate(0, hingeY);
      g.scale(1, 1 - 0.88 * s.open);
      g.translate(0, -hingeY);
      flapPath(g);
      g.clip();
      g.drawImage(can, 0, 0, w, h);
      g.fillStyle = `rgba(8,4,3,${0.6 * s.open})`;
      g.fillRect(180, hingeY - 10, 160, 70);
      g.restore();
      // бульбашки біля отвору
      for (const b of s.bubbles) {
        const al = Math.sin((b.age / b.life) * Math.PI) * 0.7;
        g.strokeStyle = `rgba(230,220,210,${al})`;
        g.lineWidth = 0.6;
        g.beginPath();
        g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
      // товщина зрізаного краю: світла кромка й тінь усередині
      g.save();
      flapPath(g);
      g.strokeStyle = "rgba(235,235,235,0.85)";
      g.lineWidth = 1.4;
      g.stroke();
      g.translate(0, 1.5);
      flapPath(g);
      g.strokeStyle = "rgba(0,0,0,0.5)";
      g.lineWidth = 1.2;
      g.stroke();
      g.restore();
    } else if (a > 0.02) {
      // носик тисне на клапан ще до розриву — легка вмʼятина
      g.save();
      flapPath(g);
      g.clip();
      const dent = g.createRadialGradient(rx, hingeY + 4, 0, rx, hingeY + 4, 40);
      dent.addColorStop(0, `rgba(0,0,0,${0.35 * (a / OPEN_AT)})`);
      dent.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = dent;
      g.fillRect(180, hingeY - 10, 160, 70);
      g.restore();
    }

    // тінь піднятого кільця на кришці
    if (a > 0.02) {
      g.save();
      g.globalAlpha = Math.min(0.45, a * 0.5);
      const sx = rx + 12 * Math.sin(a);
      const sy = ry - 30 + 10 * Math.sin(a);
      const sg = g.createRadialGradient(sx, sy, 0, sx, sy, 40);
      sg.addColorStop(0, "rgba(0,0,0,0.8)");
      sg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = sg;
      g.beginPath();
      g.ellipse(sx, sy, 42, 26, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    // --- кільце: дві частини навколо заклепки ---
    const drawPart = (upper: boolean) => {
      g.save();
      g.beginPath();
      // межа частин — шарнір клапана: усе вище лишається над кришкою, носик нижче йде всередину
      if (upper) g.rect(meta.tab.x - 5, meta.tab.y - 80, meta.tab.w + 10, hingeY - meta.tab.y + 80);
      else g.rect(meta.tab.x - 5, hingeY, meta.tab.w + 10, meta.tab.h);
      g.clip();
      if (!upper && s.opened) {
        // носик уже під кришкою — видно лише крізь отвір
        flapPath(g);
        g.clip();
      }
      g.translate(rx, ry);
      g.scale(1, S);
      g.translate(-rx, -ry);
      g.drawImage(tab, meta.tab.x, meta.tab.y);
      if (a > 0.02) {
        // піднята частина ловить більше світла; носик усередині — темніший
        if (upper) {
          // піднята частина ловить більше світла
          g.globalCompositeOperation = "lighter";
          g.globalAlpha = 0.22 * Math.sin(a);
          g.drawImage(tab, meta.tab.x, meta.tab.y);
        }
      }
      g.restore();
    };
    drawPart(false);
    drawPart(true);
    g.restore();
    return busy;
  });

  useEffect(() => {
    wake();
  }, [size, wake]);

  const toFrame = (px: number, py: number) => {
    const { s, ox, oy } = view();
    return [(px - ox) / s, (py - oy) / s] as const;
  };

  usePointer(rootRef, {
    down: (p) => {
      const s = st.current;
      if (s.auto) return false;
      const [x, y] = toFrame(p.x, p.y);
      // щедра зона: усе кільце й трохи довкола (без ювелірної точності)
      const S = stretch(s.lift);
      const ringY = meta.rivet[1] + (meta.tab.ringTip[1] - meta.rivet[1]) * S;
      if (Math.hypot(x - meta.tab.ringTip[0], y - (ringY + 22)) > 70) return false;
      onInteract();
      s.grab = { id: p.id, y0: y, lift0: s.lift };
      wake();
    },
    move: (p) => {
      const s = st.current;
      if (s.grab?.id !== p.id) return;
      const [, y] = toFrame(p.x, p.y);
      s.lift = Math.max(0, Math.min(MAX_LIFT, s.grab.lift0 + (s.grab.y0 - y) / PX_PER_RAD));
      wake();
    },
    up: (p, cancelled) => {
      const s = st.current;
      if (s.grab?.id !== p.id) return;
      s.grab = null;
      if (!s.opened && !cancelled && s.lift > 0.08) setHint("Ще трохи вище — до клацання.");
      wake();
    },
  });

  const openByButton = () => {
    onInteract();
    const s = st.current;
    if (s.opened) return;
    s.grab = null;
    s.auto = { t: 0 };
    wake();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const s = st.current;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openByButton();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      onInteract();
      s.lift = Math.max(0, Math.min(MAX_LIFT, s.lift + (e.key === "ArrowUp" ? 0.15 : -0.15)));
      wake();
    }
  };

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKey}
      aria-label="Банка. Стрілка вгору — підняти кільце, Enter — відкрити."
      className="scene-surface relative h-full w-full overflow-hidden outline-none"
      style={{ touchAction: "none", background: meta.background }}
    >
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-x-0 bottom-1 z-10 flex justify-center px-2">
        {!opened && (
          <button type="button" onClick={openByButton} className="scene-btn border border-steel/50 bg-night/75 text-sm text-frost">
            Відкрити банку
          </button>
        )}
      </div>
      <span className="sr-only" aria-live="polite">
        {opened ? "Банку відкрито." : ""}
      </span>
    </div>
  );
}
