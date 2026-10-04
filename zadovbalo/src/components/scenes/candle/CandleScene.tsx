"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSceneAssets } from "@/lib/scene/assets";
import { useCanvas2D } from "@/lib/scene/canvas";
import { useLazyRef } from "@/lib/scene/lazyRef";
import { useFrameLoop } from "@/lib/scene/loop";
import { usePointer } from "@/lib/scene/pointer";
import { haptic, sound } from "@/lib/scene/sound";
import type { SceneProps } from "../types";
import { CANDLE_SOUNDS, drawMatch, Flame, loadCandle, type CandleAssets } from "./candleKit";

const loadFull = () => loadCandle(false);

export default function CandleScene(props: SceneProps) {
  const assets = useSceneAssets(loadFull);
  useEffect(() => sound.preload(CANDLE_SOUNDS), []);
  if (assets.status === "loading")
    return (
      <div role="status" className="grid h-full place-items-center text-sm text-mist">
        Готую свічку…
      </div>
    );
  if (assets.status === "error")
    return (
      <div className="grid h-full place-items-center gap-3 px-6 text-center text-mist">
        <p>Не вдалося завантажити свічку.</p>
        <button type="button" onClick={assets.retry} className="scene-btn border border-steel/60">
          Спробувати ще
        </button>
      </div>
    );
  return <Candle {...props} {...assets.data} />;
}

type MatchPhase = "rest" | "held" | "auto" | "leaving" | "gone";

/** Сірник лежить на столі праворуч; підняв — спалахнув. */
const REST = { x: 300, y: 792, a: Math.PI - 0.06 };
/** Голівка трохи попереду пальця — щоб палець не закривав полумʼя. */
const HEAD_OFFSET = { x: -64, y: -70 };
const HOLD_ANGLE = -2.35;
const CONTACT = 30;
const CONTACT_TIME = 0.3;

function Candle({ meta, lit, unlit, match, reducedMotion, setHint, onInteract, onSettled }: SceneProps & CandleAssets) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { canvasRef, size } = useCanvas2D();
  const [isLit, setIsLit] = useState(false);
  const [matchPhase, setMatchPhase] = useState<MatchPhase>("rest");
  const flame = useLazyRef(() => new Flame());
  const m = useLazyRef(() => ({
    phase: "rest" as MatchPhase,
    x: REST.x,
    y: REST.y,
    a: REST.a,
    burn: 0,
    contact: 0,
    grab: null as { id: number; dx: number; dy: number } | null,
    auto: 0,
    /** Звідки кнопка «Запалити» веде сірник. */
    from: { x: REST.x, y: REST.y, a: REST.a },
    ember: 0,
    t: 0,
  }));

  const setPhase = useCallback(
    (p: MatchPhase) => {
      m.current.phase = p;
      setMatchPhase(p);
    },
    [m],
  );

  const view = useCallback(() => {
    const [w, h] = meta.size;
    const portrait = size.width / size.height < (w / h) * 1.25;
    const s = portrait ? Math.max(size.width / w, size.height / h) : size.height / h;
    // на вузькому екрані трохи вище — свічка й сірник над кнопками
    return { s, ox: (size.width - w * s) / 2, oy: (size.height - h * s) / 2 + (portrait ? -size.height * 0.02 : 0) };
  }, [size, meta.size]);

  const lightCandle = useCallback(() => {
    const f = flame.current;
    if (f.lit) return;
    f.ignite();
    m.current.ember = 1;
    haptic(10);
    setIsLit(true);
    setHint("Свічка горить. Можна просто побути поруч.");
    onSettled();
    // сірник догорає й прибирається
    window.setTimeout(() => setPhase("leaving"), reducedMotion ? 200 : 900);
  }, [flame, m, setHint, onSettled, setPhase, reducedMotion]);

  const wake = useFrameLoop(rootRef, (dt, now) => {
    const g = canvasRef.current?.getContext("2d");
    if (!g || !size.width) return false;
    const t = now / 1000;
    const f = flame.current;
    const mm = m.current;
    mm.t = t;
    let busy = f.update(dt);
    const [tipX, tipY] = meta.wick.tip;

    // --- сірник ---
    if (mm.phase === "held" || mm.phase === "auto") {
      busy = true;
      mm.burn = Math.min(1, mm.burn + dt * 3);
      if (mm.phase === "auto") {
        // кнопка «Запалити»: та сама дія — сірник веде рука до ґнота
        mm.auto = Math.min(1, mm.auto + dt / 1.3);
        const e = mm.auto < 0.5 ? 2 * mm.auto * mm.auto : 1 - (-2 * mm.auto + 2) ** 2 / 2;
        const fr = mm.from;
        mm.x = fr.x + (tipX + 4 - fr.x) * e;
        mm.y = fr.y + (tipY - 6 - fr.y) * e - Math.sin(e * Math.PI) * 60;
        mm.a = fr.a + (HOLD_ANGLE - fr.a) * Math.min(1, e * 1.6);
      } else mm.a += (HOLD_ANGLE - mm.a) * Math.min(1, dt * 8);
      const d = Math.hypot(mm.x - tipX, mm.y - tipY);
      if (!f.lit) {
        if (d < CONTACT) {
          mm.contact += dt;
          if (mm.contact >= CONTACT_TIME) lightCandle();
        } else mm.contact = Math.max(0, mm.contact - dt * 2);
      }
    } else if (mm.phase === "leaving") {
      busy = true;
      mm.burn = Math.max(0, mm.burn - dt * 0.9);
      if (mm.burn < 0.4) {
        mm.x += 260 * dt;
        mm.y += 300 * dt;
        if (mm.y > meta.size[1] + 120) setPhase("gone");
      }
    }
    if (!f.lit && mm.ember > 0) {
      mm.ember = Math.max(0, mm.ember - dt * 0.45);
      busy = true;
    }

    // --- кадр ---
    const { s, ox, oy } = view();
    g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    g.fillStyle = "#0b0807";
    g.fillRect(0, 0, size.width, size.height);
    g.save();
    g.translate(ox, oy);
    g.scale(s, s);
    const [w, h] = meta.size;
    g.drawImage(unlit, 0, 0, w, h);
    // світло полумʼя (і трохи — від сірника поруч)
    const matchLight = mm.phase !== "rest" && mm.phase !== "gone" ? mm.burn * 0.22 * Math.max(0, 1 - Math.hypot(mm.x - tipX, mm.y - tipY) / 600) : 0;
    const light = Math.min(1, f.level * f.flicker() * 0.97 + matchLight);
    if (light > 0.005) {
      g.globalAlpha = light;
      g.drawImage(lit, 0, 0, w, h);
      g.globalAlpha = 1;
      // тіні «дихають» разом із полумʼям: центр світла зсувається з його хитанням
      const cx = tipX + f.sway() * 22;
      const sh = g.createRadialGradient(cx, tipY + 60, 60, cx, tipY + 60, 620);
      sh.addColorStop(0, "rgba(0,0,0,0)");
      sh.addColorStop(1, `rgba(0,0,0,${0.28 * f.level})`);
      g.fillStyle = sh;
      g.fillRect(0, 0, w, h);
    }
    // широкий екран: краї кадру тонуть у темряві
    if (ox > 0) {
      for (const side of [0, 1]) {
        const gr = g.createLinearGradient(side ? w - 40 : 40, 0, side ? w : 0, 0);
        gr.addColorStop(0, "rgba(11,8,7,0)");
        gr.addColorStop(1, "rgba(11,8,7,1)");
        g.fillStyle = gr;
        g.fillRect(side ? w - 40 : 0, 0, 40, h);
      }
    }
    f.drawPool(g, meta.top, 1);
    f.drawWick(g, meta.wick.base, meta.wick.tip, 1, f.lit ? 0.7 : mm.ember);
    f.draw(g, tipX, tipY + 2, 1);
    f.drawSmoke(g, 1);
    if (mm.phase !== "gone") drawMatch(g, match, mm.x, mm.y, mm.a, 1, mm.phase === "rest" ? 0 : mm.burn, t);
    g.restore();
    return busy;
  });

  useEffect(() => {
    wake();
  }, [size, wake, isLit, matchPhase]);

  const toFrame = (px: number, py: number) => {
    const { s, ox, oy } = view();
    return [(px - ox) / s, (py - oy) / s] as const;
  };

  const strike = useCallback(() => {
    sound.sample("match", { gain: 0.55 });
    haptic(8);
  }, []);

  usePointer(rootRef, {
    down: (p) => {
      const mm = m.current;
      if (mm.phase !== "rest" && mm.phase !== "held") return false;
      const [x, y] = toFrame(p.x, p.y);
      // уся паличка — зона захоплення
      const ax = mm.x;
      const ay = mm.y;
      const bx = mm.x - Math.cos(mm.a) * 210;
      const by = mm.y - Math.sin(mm.a) * 210;
      const k = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
      if (Math.hypot(x - (ax + (bx - ax) * k), y - (ay + (by - ay) * k)) > 60) return false;
      onInteract();
      if (mm.phase === "rest") {
        strike();
        setHint("Піднеси полумʼя до ґнота й трохи потримай.");
      }
      setPhase("held");
      mm.grab = { id: p.id, dx: 0, dy: 0 };
      // голівка «стрибає» в пальці так, щоб бути попереду нього
      mm.x = x + HEAD_OFFSET.x;
      mm.y = y + HEAD_OFFSET.y;
      wake();
    },
    move: (p) => {
      const mm = m.current;
      if (mm.phase !== "held" || mm.grab?.id !== p.id) return;
      const [x, y] = toFrame(p.x, p.y);
      mm.x = Math.max(20, Math.min(meta.size[0] - 20, x + HEAD_OFFSET.x));
      mm.y = Math.max(20, Math.min(meta.size[1] - 20, y + HEAD_OFFSET.y));
      wake();
    },
    up: (p) => {
      const mm = m.current;
      if (mm.grab?.id !== p.id) return;
      mm.grab = null;
      // відпустив, не запаливши: сірник лишається в повітрі й горить ще трохи — можна взяти знову
      if (!flame.current.lit && mm.phase === "held") setHint("Візьми сірник знову й піднеси до ґнота.");
      wake();
    },
  });

  const lightByButton = () => {
    onInteract();
    const mm = m.current;
    if (flame.current.lit) return;
    if (mm.phase === "gone" || mm.phase === "leaving") {
      Object.assign(mm, { x: REST.x, y: REST.y, a: REST.a, burn: 0, contact: 0, auto: 0 });
    }
    if (mm.phase !== "held") strike();
    mm.auto = 0;
    mm.grab = null;
    mm.from = { x: mm.x, y: mm.y, a: mm.a };
    setPhase("auto");
    wake();
  };

  const putOut = () => {
    onInteract();
    const [tx, ty] = meta.wick.tip;
    flame.current.extinguish(tx, ty);
    setIsLit(false);
    setHint("Свічка згасла. Тонкий дим піднімається вгору.");
    wake();
  };

  const newMatch = () => {
    const mm = m.current;
    Object.assign(mm, { x: REST.x, y: REST.y, a: REST.a, burn: 0, contact: 0, auto: 0 });
    setPhase("rest");
    setHint("Візьми сірник — він спалахне.");
    wake();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (isLit) putOut();
      else lightByButton();
    }
  };

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKey}
      aria-label={isLit ? "Свічка горить. Enter — загасити." : "Свічка не горить. Enter — запалити."}
      className="scene-surface relative h-full w-full overflow-hidden outline-none"
      style={{ touchAction: "none", background: "#0b0807" }}
    >
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-x-0 bottom-1 z-10 flex flex-wrap items-center justify-center gap-2 px-2">
        {isLit ? (
          <button type="button" onClick={putOut} className="scene-btn border border-steel/50 bg-night/75 text-sm text-frost">
            Загасити
          </button>
        ) : (
          <>
            <button type="button" onClick={lightByButton} className="scene-btn border border-steel/50 bg-night/75 text-sm text-frost">
              Запалити
            </button>
            {(matchPhase === "gone" || matchPhase === "leaving") && (
              <button type="button" onClick={newMatch} className="scene-btn border border-steel/50 bg-night/75 text-sm text-frost">
                Новий сірник
              </button>
            )}
          </>
        )}
      </div>
      <span className="sr-only" aria-live="polite">
        {isLit ? "Свічка горить." : ""}
      </span>
    </div>
  );
}
