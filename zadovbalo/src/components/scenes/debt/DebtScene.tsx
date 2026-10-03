"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useFrameLoop } from "@/lib/scene/loop";
import { bindPointer } from "@/lib/scene/pointer";
import { haptic, sound } from "@/lib/scene/sound";
import { applyTransfer, billStep, formatAmount, STACK_SIZE } from "@/lib/scenes/debt";
import type { SceneProps } from "../types";
import { BILL_H, BILL_PAD, BILL_W, BillSvg, billPath } from "./Bill";

type Mode = "bill" | "stack";
type Phase = "idle" | "drag" | "landing" | "return";

interface Sim {
  phase: Phase;
  pointerId: number;
  kind: Mode;
  /** Ціль (палець) і поточна позиція з інерцією. */
  tx: number;
  ty: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bend: number;
  lift: number;
  scale: number;
  opacity: number;
  /** Куди повертатися. */
  homeX: number;
  homeY: number;
  committed: boolean;
}

const FINGER_OFFSET = 58; // купюру видно над пальцем

export default function DebtScene({ input, reducedMotion, onSettled, setHint }: SceneProps) {
  const total = input.amount ?? 0;
  const currency = input.currency ?? null;
  const step = billStep(total);
  const uid = useId().replace(/:/g, "");

  const rootRef = useRef<HTMLDivElement>(null);
  const slabRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const sheenRef = useRef<SVGLinearGradientElement>(null);
  const amountRef = useRef<HTMLSpanElement>(null);

  const [remaining, setRemaining] = useState(total);
  const remainingRef = useRef(total);
  const shownRef = useRef(total);
  const [mode, setMode] = useState<Mode>("bill");
  const [dragKind, setDragKind] = useState<Mode | null>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const [fontPx, setFontPx] = useState(64);
  const sim = useRef<Sim>({ phase: "idle", pointerId: -1, kind: "bill", tx: 0, ty: 0, x: 0, y: 0, vx: 0, vy: 0, bend: 0, lift: 0, scale: 1, opacity: 1, homeX: 0, homeY: 0, committed: false });
  const done = remaining <= 0;

  const label = useCallback((v: number) => formatAmount(v, currency, total), [currency, total]);

  // Розмір цифр під ширину: великі суми не обрізаються на телефоні.
  useLayoutEffect(() => {
    const slab = slabRef.current;
    if (!slab) return;
    const fit = () => {
      const chars = label(total).length;
      const w = slab.clientWidth - 32;
      setFontPx(Math.max(26, Math.min(112, (w / (chars * 0.6)) | 0)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(slab);
    return () => ro.disconnect();
  }, [label, total]);

  const commit = useCallback(
    (kind: Mode, at?: { x: number; y: number }) => {
      if (remainingRef.current <= 0) return;
      const next = applyTransfer(remainingRef.current, step * (kind === "stack" ? STACK_SIZE : 1));
      remainingRef.current = next;
      setRemaining(next);
      if (at) setRipples((r) => [...r.slice(-3), { id: performance.now(), ...at }]);
      sound.play("thud", kind === "stack" ? 0.9 : 0.6);
      sound.play("paper", 0.4);
      haptic(kind === "stack" ? 14 : 8);
      if (next <= 0) {
        onSettled();
        setHint("Можна побути тут скільки треба.");
      } else if (next < total) setHint("Ще. У своєму темпі.");
    },
    [onSettled, setHint, step, total],
  );

  const render = useCallback(() => {
    const s = sim.current;
    const el = dragRef.current;
    if (!el) return;
    const tilt = reducedMotion ? 0 : Math.max(-22, Math.min(22, s.vy * 0.03));
    const rot = reducedMotion ? 0 : Math.max(-14, Math.min(14, s.vx * 0.012));
    el.style.transform = `translate3d(${s.x - (BILL_W / 2 + BILL_PAD)}px, ${s.y - (BILL_H / 2 + BILL_PAD)}px, 0) perspective(700px) rotateX(${tilt}deg) rotate(${rot}deg) scale(${s.scale})`;
    el.style.opacity = String(s.opacity);
    pathRef.current?.setAttribute("d", billPath(s.bend * (s.kind === "stack" ? 0.3 : 1), reducedMotion ? 0 : s.vx * 0.006));
    sheenRef.current?.setAttribute("gradientTransform", `translate(${Math.max(-0.4, Math.min(0.4, -s.vx * 0.0006))} 0)`);
    const sh = shadowRef.current;
    if (sh) {
      // Контактна тінь: вище підйом — ширша й мʼякша, зсунута вниз.
      sh.style.transform = `translate3d(${s.x - BILL_W / 2}px, ${s.y - BILL_H / 2 + 10 + s.lift * 0.6}px, 0) scale(${s.scale * (1 + s.lift * 0.004)})`;
      sh.style.opacity = String(s.opacity * Math.max(0.35, 0.75 - s.lift * 0.006));
      sh.style.filter = `blur(${6 + s.lift * 0.25}px)`;
    }
  }, [reducedMotion]);

  const wake = useFrameLoop(
    rootRef,
    (dt) => {
      const s = sim.current;
      let busy = false;
      if (s.phase === "drag" || s.phase === "return") {
        // Пружина з затуханням: інерція без ривків.
        const k = reducedMotion ? 60 : s.kind === "stack" ? 120 : 170;
        const c = reducedMotion ? 16 : s.kind === "stack" ? 20 : 19;
        const tx = s.phase === "return" ? s.homeX : s.tx;
        const ty = s.phase === "return" ? s.homeY : s.ty;
        s.vx += ((tx - s.x) * k - s.vx * c) * dt;
        s.vy += ((ty - s.y) * k - s.vy * c) * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const targetBend = Math.max(-20, Math.min(20, -s.vx * 0.025 - s.vy * 0.012));
        s.bend += (targetBend - s.bend) * Math.min(1, dt * 14);
        s.lift += ((s.phase === "drag" ? 40 : 0) - s.lift) * Math.min(1, dt * 8);
        busy = true;
        if (s.phase === "return" && Math.hypot(s.homeX - s.x, s.homeY - s.y) < 2 && Math.hypot(s.vx, s.vy) < 20) {
          s.phase = "idle";
          setDragKind(null);
        }
      } else if (s.phase === "landing") {
        // Мʼяко лягає на суму.
        s.x += (s.tx - s.x) * Math.min(1, dt * 12);
        s.y += (s.ty - s.y) * Math.min(1, dt * 12);
        s.lift += (0 - s.lift) * Math.min(1, dt * 14);
        s.bend *= 0.8;
        s.scale += (0.55 - s.scale) * Math.min(1, dt * 7);
        s.opacity -= dt * 3.2;
        busy = true;
        if (s.opacity <= 0) {
          s.phase = "idle";
          setDragKind(null);
        }
      }
      if (busy) render();

      // Плавний лічильник.
      const target = remainingRef.current;
      if (Math.abs(shownRef.current - target) > 0.004) {
        const diff = target - shownRef.current;
        shownRef.current = Math.abs(diff) < Math.max(0.01, total * 0.0005) ? target : shownRef.current + diff * Math.min(1, dt * 9);
        if (amountRef.current) amountRef.current.textContent = label(shownRef.current);
        busy = true;
      }
      return busy;
    },
    true,
  );

  // Свіжі значення для обробників, привʼязаних один раз.
  const modeRef = useRef(mode);
  const commitRef = useRef(commit);
  useEffect(() => {
    modeRef.current = mode;
    commitRef.current = commit;
  });

  // Жести.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    return bindPointer(root, {
      down: (p) => {
        const s = sim.current;
        if (s.phase !== "idle" || remainingRef.current <= 0) return false; // один жест за раз
        const tray = trayRef.current?.getBoundingClientRect();
        const r = root.getBoundingClientRect();
        if (!tray || p.x < tray.left - r.left || p.x > tray.right - r.left || p.y < tray.top - r.top || p.y > tray.bottom - r.top) return false;
        s.phase = "drag";
        s.pointerId = p.id;
        s.kind = modeRef.current;
        s.committed = false;
        s.homeX = tray.left - r.left + tray.width / 2;
        s.homeY = tray.top - r.top + tray.height / 2;
        s.x = s.homeX;
        s.y = s.homeY;
        s.tx = p.x;
        s.ty = p.y - FINGER_OFFSET;
        s.vx = s.vy = 0;
        s.bend = 0;
        s.lift = 0;
        s.scale = 1;
        s.opacity = 1;
        setDragKind(modeRef.current);
        sound.play("paper", 0.35);
        wake();
      },
      move: (p) => {
        const s = sim.current;
        if (s.phase !== "drag" || p.id !== s.pointerId) return;
        s.tx = p.x;
        s.ty = p.y - FINGER_OFFSET;
        wake();
      },
      up: (p, cancelled) => {
        const s = sim.current;
        if (s.phase !== "drag" || p.id !== s.pointerId) return;
        const slab = slabRef.current?.getBoundingClientRect();
        const r = root.getBoundingClientRect();
        const bx = s.x + r.left;
        const by = s.y + r.top;
        const hit = !cancelled && slab && bx > slab.left - 24 && bx < slab.right + 24 && by > slab.top - 24 && by < slab.bottom + 24;
        if (hit && !s.committed) {
          s.committed = true; // повторний жест / мультитач не спише двічі
          s.phase = "landing";
          s.tx = Math.max(slab.left + 30, Math.min(slab.right - 30, bx)) - r.left;
          s.ty = Math.max(slab.top + 20, Math.min(slab.bottom - 20, by)) - r.top;
          commitRef.current(s.kind, { x: s.tx - (slab.left - r.left), y: s.ty - (slab.top - r.top) });
        } else {
          s.phase = "return";
        }
        wake();
      },
    });
  }, [wake]);

  const keyboardTransfer = () => {
    if (done || sim.current.phase !== "idle") return;
    commit(mode);
    wake();
  };

  if (!(total > 0)) {
    return <div className="grid h-full place-items-center px-6 text-center text-mist">Спершу вкажи суму.</div>;
  }

  return (
    <div ref={rootRef} className="scene-surface relative flex h-full flex-col items-center justify-between gap-4 px-4 pb-2 pt-2">
      {/* Світлішає, коли сума дійшла до нуля */}
      <div aria-hidden className={cn("pointer-events-none absolute inset-0 transition-opacity duration-[2400ms]", done ? "opacity-100" : "opacity-0")} style={{ background: "radial-gradient(80% 60% at 50% 35%, rgb(159 176 186 / 0.28), transparent 75%)" }} />

      {/* Сума — ціль */}
      <div className="relative flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-3">
        <div
          ref={slabRef}
          className={cn(
            "relative w-full overflow-hidden rounded-[6px] px-4 py-10 text-center transition-[transform,background-color,box-shadow] duration-700 sm:py-14",
            done ? "scale-[1.02] bg-[#1d3140]/40 shadow-none" : "bg-gradient-to-b from-[#1c2e3b] to-[#101d27]",
          )}
          style={{ boxShadow: done ? undefined : "inset 0 1px 0 rgb(231 235 237 / .12), inset 0 -2px 0 rgb(0 0 0 / .35), 0 30px 60px -30px rgb(0 0 0 / .9), 0 2px 0 rgb(0 0 0 / .4)" }}
          aria-live="polite"
          aria-atomic
        >
          <span className="sr-only">Залишок: {label(remaining)}</span>
          <span
            ref={amountRef}
            aria-hidden
            className="block whitespace-nowrap font-display font-semibold leading-none tracking-[-0.02em] [font-variant-numeric:lining-nums_tabular-nums]"
            style={{
              fontSize: fontPx,
              color: done ? "#e7ebed" : "#dfe6ea",
              // Обʼєм: видавлення шарами тіні + верхнє світло.
              textShadow: done
                ? "0 0 40px rgb(159 176 186 / .25)"
                : "0 1px 0 #9fb0ba, 0 2px 0 #6c8291, 0 3px 0 #50677a, 0 4px 0 #3c5263, 0 5px 0 #2c4050, 0 12px 22px rgb(0 0 0 / .55)",
              transition: "color 1.5s, text-shadow 1.5s",
            }}
          >
            {label(total)}
          </span>
          {ripples.map((r) => (
            <span
              key={r.id}
              aria-hidden
              className="pointer-events-none absolute size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-frost/40 motion-safe:animate-[debt-ripple_900ms_ease-out_forwards]"
              style={{ left: r.x, top: r.y }}
              onAnimationEnd={() => setRipples((all) => all.filter((x) => x.id !== r.id))}
            />
          ))}
        </div>
        <p className="max-w-md text-center text-xs text-mist/85 sm:text-sm">Це символічна вправа. Реальна сума боргу не змінюється.</p>
      </div>

      {/* Лоток із купюрами */}
      {!done ? (
        <div className="relative flex w-full max-w-md flex-col items-center gap-3">
          <div
            ref={trayRef}
            className="relative grid h-40 w-full max-w-[21rem] cursor-grab place-items-center rounded-[6px] active:cursor-grabbing"
            aria-hidden
          >
            {/* Освітлена поверхня, на якій лежать купюри */}
            <div className="absolute inset-x-[-12%] bottom-[-6%] top-[22%] rounded-[50%] bg-[radial-gradient(closest-side,rgb(86_116_135/0.35),transparent)]" />
            <div className="absolute inset-x-10 bottom-6 h-5 rounded-full bg-black/60 blur-lg" />
            {mode === "bill" ? (
              <div className="relative scale-110">
                <div className="absolute left-2 top-1 rotate-[-6deg] opacity-80">
                  <BillSvg id={`${uid}a`} />
                </div>
                <div className="absolute -left-1 top-0 rotate-[4deg] opacity-90">
                  <BillSvg id={`${uid}b`} />
                </div>
                <div className={cn("relative rotate-[-1deg] transition-opacity", dragKind === "bill" && "opacity-70")}>
                  <BillSvg id={`${uid}c`} />
                </div>
              </div>
            ) : (
              <div className="relative scale-110">
                <div className="absolute left-3 top-2 rotate-[-5deg] opacity-80">
                  <BillSvg id={`${uid}d`} stack />
                </div>
                <div className="relative rotate-[2deg]">
                  <BillSvg id={`${uid}e`} stack />
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div role="radiogroup" aria-label="Як переносити" className="flex overflow-hidden rounded-[var(--radius-hair)] border border-steel/50">
              {(["bill", "stack"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={cn("min-h-11 px-3 text-sm", mode === m ? "bg-frost text-abyss" : "text-frost/80 hover:bg-night")}
                >
                  {m === "bill" ? "По купюрі" : "Пачкою"}
                </button>
              ))}
            </div>
            <button type="button" onClick={keyboardTransfer} className="scene-btn border border-steel/50">
              Перенести {mode === "bill" ? "купюру" : "пачку"}
            </button>
          </div>
        </div>
      ) : (
        <RealStep />
      )}

      {/* Купюра в руці */}
      <div ref={shadowRef} aria-hidden className={cn("pointer-events-none absolute left-0 top-0 rounded-[40%] bg-black", dragKind ? "block" : "hidden")} style={{ width: BILL_W, height: BILL_H, willChange: "transform" }} />
      <div ref={dragRef} aria-hidden className={cn("pointer-events-none absolute left-0 top-0", dragKind ? "block" : "hidden")} style={{ willChange: "transform", transformOrigin: "50% 50%" }}>
        {dragKind && <BillSvg id={`${uid}drag`} stack={dragKind === "stack"} pathRef={pathRef} sheenRef={sheenRef} />}
      </div>
    </div>
  );
}

/** Необовʼязковий реальний крок. Ніде не зберігається, доки людина сама не збереже файл. */
function RealStep() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="scene-btn mb-2 border border-steel/50">
        Записати один реальний крок
      </button>
    );
  const save = () => {
    const blob = new Blob([`Один реальний крок:\n${text.trim()}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "krok.txt";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="mb-2 flex w-full max-w-md flex-col gap-2">
      <label className="text-sm text-frost/85" htmlFor="real-step">
        Один маленький реальний крок — наприклад, «дізнатися точну суму» чи «написати в банк про реструктуризацію».
      </label>
      <textarea id="real-step" value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={300} className="rounded-[var(--radius-hair)] border border-steel/55 bg-abyss/70 px-3 py-2 text-frost" />
      <p className="text-xs text-mist">Цей запис лишається тільки на екрані. Зберегти його — лише твоє рішення.</p>
      <button type="button" disabled={!text.trim()} onClick={save} className="scene-btn self-start border border-steel/50 disabled:opacity-40">
        Зберегти собі файлом
      </button>
    </div>
  );
}
