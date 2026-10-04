"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/cn";
import { useSceneAssets } from "@/lib/scene/assets";
import { drawBent, drawSoftShadow } from "@/lib/scene/bend";
import { useCanvas2D } from "@/lib/scene/canvas";
import { useLazyRef } from "@/lib/scene/lazyRef";
import { useFrameLoop } from "@/lib/scene/loop";
import { usePointer } from "@/lib/scene/pointer";
import { haptic, sound } from "@/lib/scene/sound";
import {
  applyTransfer,
  formatAmount,
  PACK_SIZE,
  planDebt,
  transferred,
} from "@/lib/scenes/debt";
import type { SceneProps } from "../types";
import { loadMoneyManifest, loadNote, type NoteArt } from "./notes";

type Mode = "bill" | "pack";
type Phase = "idle" | "drag" | "landing" | "return";

interface Sim {
  phase: Phase;
  pointerId: number;
  kind: Mode;
  /** Палець (ціль) і точка захоплення з інерцією. */
  tx: number;
  ty: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  av: number;
  sag: number;
  lag: number;
  lift: number;
  grabU: number;
  grabV: number;
  /** Посадка: звідки й куди. */
  t: number;
  fromX: number;
  fromY: number;
  fromA: number;
  toX: number;
  toY: number;
  toA: number;
  homeX: number;
  homeY: number;
  committed: boolean;
}

interface PileItem {
  dx: number;
  dy: number;
  a: number;
  kind: Mode;
}

const FINGER_LIFT = 34; // купюру видно над пальцем на сенсорному екрані
const PILE_SCALE = 0.56;

export default function DebtScene({
  input,
  reducedMotion,
  onSettled,
  setHint,
  onInteract,
  onEditInput,
}: SceneProps) {
  const total = input.amount ?? 0;
  // Вправа лише в гривнях: сума вже підтверджена в гривнях на кроці налаштування.
  const currency = "UAH" as const;
  const assets = useSceneAssets(async () => {
    const manifest = await loadMoneyManifest();
    const plan = planDebt(total);
    const note = await loadNote(plan.note, manifest);
    return { plan, note };
  });

  if (!(total > 0)) {
    return (
      <div className="grid h-full place-items-center px-6 text-center text-mist">
        Спершу вкажи суму.
      </div>
    );
  }
  if (assets.status === "loading")
    return (
      <div
        role="status"
        className="grid h-full place-items-center text-sm text-mist"
      >
        Готую купюри…
      </div>
    );
  if (assets.status === "error")
    return (
      <div className="grid h-full place-items-center gap-3 px-6 text-center text-mist">
        <p>Не вдалося завантажити купюри.</p>
        <button
          type="button"
          onClick={assets.retry}
          className="scene-btn border border-steel/60"
        >
          Спробувати ще
        </button>
      </div>
    );
  return (
    <Debt
      total={total}
      currency={currency}
      plan={assets.data.plan}
      note={assets.data.note}
      reducedMotion={reducedMotion}
      onSettled={onSettled}
      setHint={setHint}
      onInteract={onInteract}
      onEditInput={onEditInput}
    />
  );
}

function Debt({
  total,
  currency,
  plan,
  note,
  reducedMotion,
  onSettled,
  setHint,
  onInteract,
  onEditInput,
}: {
  total: number;
  currency: SceneProps["input"]["currency"];
  plan: ReturnType<typeof planDebt>;
  note: NoteArt;
  reducedMotion: boolean;
  onSettled: () => void;
  setHint: (h: string) => void;
  onInteract: () => void;
  onEditInput?: () => void;
}) {
  const { canvasRef, ctx, size } = useCanvas2D();
  const rootRef = useRef<HTMLDivElement>(null);
  const slabRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const pileRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLSpanElement>(null);

  const [remaining, setRemaining] = useState(total);
  const remainingRef = useRef(total);
  const shownRef = useRef(total);
  const [mode, setMode] = useState<Mode>(plan.billMode ? "bill" : "pack");
  const modeRef = useRef(mode);
  const [deltas, setDeltas] = useState<{ id: number; text: string }[]>([]);
  const [fontPx, setFontPx] = useState(64);
  const pile = useLazyRef<PileItem[]>(() => []);
  const sim = useLazyRef<Sim>(() => ({
    phase: "idle",
    pointerId: -1,
    kind: "bill",
    tx: 0,
    ty: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    av: 0,
    sag: 0,
    lag: 0,
    lift: 0,
    grabU: 0.5,
    grabV: 0.5,
    t: 0,
    fromX: 0,
    fromY: 0,
    fromA: 0,
    toX: 0,
    toY: 0,
    toA: 0,
    homeX: 0,
    homeY: 0,
    committed: false,
  }));
  const done = remaining <= 0;
  const label = useCallback(
    (v: number) => formatAmount(v, currency, total),
    [currency, total],
  );
  useEffect(() => {
    modeRef.current = mode;
    if (remainingRef.current > 0)
      setHint(
        mode === "pack"
          ? "Візьми пачку й перенеси на суму."
          : "Візьми купюру й перенеси на суму.",
      );
  }, [mode, setHint]);

  // Розмір купюри під ширину екрана.
  const noteW = Math.max(132, Math.min(size.width * 0.46, 236));
  const noteH = (noteW * note.h) / note.w;

  // Цифри — під ширину, щоб великі суми не обрізались.
  useLayoutEffect(() => {
    const slab = slabRef.current;
    if (!slab) return;
    const fit = () => {
      const chars = label(total).length;
      setFontPx(
        Math.max(
          28,
          Math.min(108, ((slab.clientWidth - 32) / (chars * 0.6)) | 0),
        ),
      );
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(slab);
    return () => ro.disconnect();
  }, [label, total]);

  const stepFor = (kind: Mode) => (kind === "pack" ? plan.pack : plan.bill);

  const rel = useCallback((el: HTMLElement | null) => {
    const root = rootRef.current;
    if (!el || !root) return null;
    const r = el.getBoundingClientRect();
    const o = root.getBoundingClientRect();
    return {
      x: r.left - o.left,
      y: r.top - o.top,
      w: r.width,
      h: r.height,
      cx: r.left - o.left + r.width / 2,
      cy: r.top - o.top + r.height / 2,
    };
  }, []);

  const pileTarget = useCallback(() => {
    const p = rel(pileRef.current);
    const n = pile.current.length;
    if (!p) return { x: 0, y: 0, a: 0 };
    return {
      x: p.cx + ((n * 37) % 23) - 11,
      y: p.cy - Math.min(n, 40) * 0.9 + ((n * 17) % 9) - 4,
      a: (((n * 53) % 21) - 10) * 0.012,
    };
  }, [rel, pile]);

  /** Списати один перенос. Викликається рівно раз на жест (захист від подвійного списання). */
  const commit = useCallback(
    (kind: Mode) => {
      if (remainingRef.current <= 0) return false;
      const value = transferred(remainingRef.current, stepFor(kind));
      const next = applyTransfer(remainingRef.current, stepFor(kind));
      remainingRef.current = next;
      setRemaining(next);
      setDeltas((d) => [
        ...d.slice(-2),
        { id: performance.now(), text: `−${label(value)}` },
      ]);
      sound.play("paper", 0.5);
      sound.play("thud", kind === "pack" ? 0.8 : 0.4);
      haptic(kind === "pack" ? 14 : 8);
      if (next <= 0) {
        onSettled();
        setHint("Нуль. Хоча б в уяві. Можна побути тут скільки треба.");
      } else setHint("Ще. У своєму темпі.");
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [label, onSettled, setHint, plan],
  );

  const drawFlat = useCallback(
    (
      g: CanvasRenderingContext2D,
      x: number,
      y: number,
      a: number,
      s: number,
      kind: Mode,
    ) => {
      const w = noteW * s;
      const h = noteH * s;
      g.save();
      g.translate(x, y);
      g.rotate(a);
      if (kind === "pack") {
        // Видима товщина пачки: краї аркушів.
        const layers = Math.round(9 * s) + 3;
        for (let i = layers; i > 0; i--) {
          g.fillStyle = i % 2 ? "#cfc8b8" : "#e4ded0";
          g.fillRect(-w / 2 + i * 0.25, -h / 2 + i * 1.15, w, h);
        }
        g.strokeStyle = "rgba(0,0,0,0.25)";
        g.strokeRect(-w / 2 + layers * 0.25, -h / 2 + layers * 1.15, w, h);
      }
      g.drawImage(note.img, -w / 2, -h / 2, w, h);
      if (kind === "pack") {
        // Банківська стрічка з чесним підписом.
        const bw = w * 0.15;
        const bx = w * 0.3;
        g.fillStyle = "#e9e1cf";
        g.fillRect(bx - bw / 2, -h / 2 - 1, bw, h + 2 + 9 * s);
        g.strokeStyle = "rgba(80,70,55,0.5)";
        g.lineWidth = 1;
        g.strokeRect(bx - bw / 2, -h / 2 - 1, bw, h + 2 + 9 * s);
        g.save();
        g.translate(bx, 0);
        g.rotate(-Math.PI / 2);
        g.fillStyle = "#4a4234";
        g.font = `600 ${Math.max(8, 11 * s)}px system-ui, sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(
          plan.packs > 1 ? `${plan.packs}×${PACK_SIZE}` : `${PACK_SIZE} шт`,
          0,
          0,
          h * 0.9,
        );
        g.restore();
      }
      g.restore();
    },
    [note, noteW, noteH, plan.packs],
  );

  const draw = useCallback(() => {
    const g = canvasRef.current?.getContext("2d") ?? null;
    if (!g) return;
    g.clearRect(0, 0, size.width, size.height);
    const s = sim.current;
    // Стопка біля суми.
    const pp = rel(pileRef.current);
    if (pp) {
      const items = pile.current;
      const start = Math.max(0, items.length - 14);
      if (items.length > 0)
        drawSoftShadow(
          g,
          pp.cx + 4,
          pp.cy + 8,
          noteW * PILE_SCALE,
          noteH * PILE_SCALE,
          0,
          14,
          0.55,
        );
      // Нижні — як суцільна товщина.
      const thick = Math.min(items.length, 40) * 0.9;
      if (thick > 1) {
        g.fillStyle = "#b9b2a2";
        g.fillRect(
          pp.cx - (noteW * PILE_SCALE) / 2,
          pp.cy + (noteH * PILE_SCALE) / 2 - thick,
          noteW * PILE_SCALE,
          thick,
        );
      }
      for (let i = start; i < items.length; i++) {
        const it = items[i]!;
        drawFlat(g, pp.cx + it.dx, pp.cy + it.dy, it.a, PILE_SCALE, it.kind);
      }
    }
    // Лоток.
    const tr = rel(trayRef.current);
    if (tr && remainingRef.current > 0) {
      const kind = modeRef.current;
      const holding = s.phase === "drag" || s.phase === "return";
      const n = kind === "pack" ? 2 : 4;
      drawSoftShadow(g, tr.cx + 6, tr.cy + 10, noteW, noteH, -0.02, 18, 0.6);
      for (let i = n - 1; i >= (holding ? 1 : 0); i--)
        drawFlat(
          g,
          tr.cx + i * 3 - 4,
          tr.cy + i * 2.5 - 3,
          (i - 1) * 0.035,
          1,
          kind,
        );
    }
    // Купюра в руці або в польоті.
    if (s.phase !== "idle") {
      const scale =
        s.phase === "landing" ? 1 + (PILE_SCALE - 1) * ease(s.t) : 1;
      const w = noteW * scale;
      const h = noteH * scale;
      const lift = s.phase === "landing" ? s.lift * (1 - s.t) : s.lift;
      drawSoftShadow(
        g,
        s.x + lift * 0.35 + (0.5 - s.grabU) * w * Math.cos(s.angle),
        s.y + lift * 0.7 + (0.5 - s.grabV) * h,
        w * 0.96,
        h * 0.92,
        s.angle,
        8 + lift * 0.45,
        Math.max(0.25, 0.6 - lift * 0.005),
      );
      if (s.kind === "pack") {
        // Пачка майже не гнеться — малюємо пласко з поворотом.
        drawFlat(
          g,
          s.x + (0.5 - s.grabU) * w * Math.cos(s.angle),
          s.y + (0.5 - s.grabV) * h + (0.5 - s.grabU) * w * Math.sin(s.angle),
          s.angle,
          scale * (1 + lift * 0.002),
          "pack",
        );
      } else {
        drawBent(g, note.img, note.w, note.h, {
          x: s.x,
          y: s.y,
          w,
          h,
          angle: s.angle,
          grabU: s.grabU,
          grabV: s.grabV,
          sag: s.sag,
          lag: s.lag,
          lift,
        });
      }
    }
  }, [size, rel, drawFlat, noteW, noteH, note, canvasRef, pile, sim]);

  const wake = useFrameLoop(rootRef, (dt) => {
    const s = sim.current;
    let busy = false;
    if (s.phase === "drag" || s.phase === "return") {
      const tx = s.phase === "return" ? s.homeX : s.tx;
      const ty = s.phase === "return" ? s.homeY : s.ty;
      const k = reducedMotion ? 90 : s.kind === "pack" ? 140 : 190;
      const c = reducedMotion ? 19 : s.kind === "pack" ? 22 : 20;
      const ax = (tx - s.x) * k - s.vx * c;
      const ay = (ty - s.y) * k - s.vy * c;
      s.vx += ax * dt;
      s.vy += ay * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      // Кутова інерція: край, що далі від пальця, відстає за рухом.
      const lever = s.grabU - 0.5;
      const targetA = reducedMotion
        ? 0
        : Math.max(
            -0.5,
            Math.min(0.5, -s.vy * lever * 0.0011 + s.vx * 0.00018),
          );
      s.av += ((targetA - s.angle) * 60 - s.av * 11) * dt;
      s.angle += s.av * dt;
      const speed = Math.hypot(s.vx, s.vy);
      const targetSag =
        s.kind === "pack" ? 0 : 0.16 + Math.min(0.18, speed * 0.00018);
      s.sag += (targetSag - s.sag) * Math.min(1, dt * 10);
      const targetLag =
        reducedMotion || s.kind === "pack"
          ? 0
          : Math.max(-0.35, Math.min(0.35, s.vx * 0.0005));
      s.lag += (targetLag - s.lag) * Math.min(1, dt * 9);
      s.lift += ((s.phase === "drag" ? 38 : 0) - s.lift) * Math.min(1, dt * 9);
      busy = true;
      if (
        s.phase === "return" &&
        Math.hypot(s.homeX - s.x, s.homeY - s.y) < 1.5 &&
        speed < 15
      ) {
        s.phase = "idle";
      }
    } else if (s.phase === "landing") {
      s.t = Math.min(1, s.t + dt / (reducedMotion ? 0.2 : 0.5));
      const e = ease(s.t);
      s.x = s.fromX + (s.toX - s.fromX) * e;
      s.y = s.fromY + (s.toY - s.fromY) * e - Math.sin(Math.PI * s.t) * 18;
      s.angle = s.fromA + (s.toA - s.fromA) * e;
      s.sag *= 0.85;
      s.lag *= 0.8;
      busy = true;
      if (s.t >= 1) {
        const p = rel(pileRef.current);
        if (p)
          pile.current.push({
            dx: s.toX - p.cx,
            dy: s.toY - p.cy,
            a: s.toA,
            kind: s.kind,
          });
        s.phase = "idle";
      }
    }
    // Плавний лічильник.
    const target = remainingRef.current;
    if (Math.abs(shownRef.current - target) > 0.004) {
      const diff = target - shownRef.current;
      shownRef.current =
        Math.abs(diff) < Math.max(0.01, total * 0.0004)
          ? target
          : shownRef.current +
            diff * Math.min(1, dt * (reducedMotion ? 30 : 7));
      if (amountRef.current)
        amountRef.current.textContent = label(shownRef.current);
      busy = true;
    }
    draw();
    return busy;
  });

  // Перемалювати при зміні розміру/режиму.
  useEffect(() => {
    draw();
    wake();
  }, [draw, wake, mode, size]);

  /** Почати посадку купюри на стопку (після зарахування). */
  const land = useCallback(
    (
      fromX: number,
      fromY: number,
      fromA: number,
      grabU: number,
      grabV: number,
    ) => {
      const s = sim.current;
      const t = pileTarget();
      // Точка захоплення → центр, щоб купюра лягла рівно.
      s.phase = "landing";
      s.t = 0;
      s.grabU = grabU;
      s.grabV = grabV;
      s.fromX = fromX;
      s.fromY = fromY;
      s.fromA = fromA;
      s.toX = t.x - (0.5 - grabU) * noteW * PILE_SCALE;
      s.toY = t.y - (0.5 - grabV) * noteH * PILE_SCALE;
      s.toA = t.a;
      wake();
    },
    [pileTarget, wake, noteW, noteH, sim],
  );

  const commitRef = useRef(commit);
  const landRef = useRef(land);
  useEffect(() => {
    commitRef.current = commit;
    landRef.current = land;
  });

  // Жести.
  usePointer(rootRef, {
    down: (p) => {
      const s = sim.current;
      if (s.phase !== "idle" || remainingRef.current <= 0) return false; // один жест за раз
      const tr = rel(trayRef.current);
      if (!tr) return false;
      const left = tr.cx - noteW / 2 - 12;
      const top = tr.cy - noteH / 2 - 12;
      if (
        p.x < left ||
        p.x > left + noteW + 24 ||
        p.y < top ||
        p.y > top + noteH + 24
      )
        return false;
      onInteract();
      const lift = p.type === "touch" ? FINGER_LIFT : 0;
      s.phase = "drag";
      s.pointerId = p.id;
      s.kind = modeRef.current;
      s.committed = false;
      // Тримаємо саме за ту точку, де торкнулись.
      s.grabU = Math.max(
        0.05,
        Math.min(0.95, (p.x - (tr.cx - noteW / 2)) / noteW),
      );
      s.grabV = Math.max(
        0.05,
        Math.min(0.95, (p.y - (tr.cy - noteH / 2)) / noteH),
      );
      s.homeX = p.x;
      s.homeY = p.y;
      s.x = p.x;
      s.y = p.y;
      s.tx = p.x;
      s.ty = p.y - lift;
      s.vx = s.vy = s.av = 0;
      s.angle = 0;
      s.sag = 0;
      s.lag = 0;
      s.lift = 0;
      sound.play("paper", 0.35);
      wake();
    },
    move: (p) => {
      const s = sim.current;
      if (s.phase !== "drag" || p.id !== s.pointerId) return;
      s.tx = p.x;
      s.ty = p.y - (p.type === "touch" ? FINGER_LIFT : 0);
      wake();
    },
    up: (p, cancelled) => {
      const s = sim.current;
      if (s.phase !== "drag" || p.id !== s.pointerId) return;
      const slab = rel(slabRef.current);
      const pile = rel(pileRef.current);
      const cx = s.x + (0.5 - s.grabU) * noteW;
      const cy = s.y + (0.5 - s.grabV) * noteH;
      const over = (
        r: { x: number; y: number; w: number; h: number } | null,
        m: number,
      ) =>
        r &&
        cx > r.x - m &&
        cx < r.x + r.w + m &&
        cy > r.y - m &&
        cy < r.y + r.h + m;
      // Ціль — сама сума й місце стопки під нею (не вся порожнеча між ними).
      const pw = noteW * PILE_SCALE + 24;
      const ph = noteH * PILE_SCALE + 24;
      const pileCore = pile
        ? { x: pile.cx - pw / 2, y: pile.cy - ph / 2, w: pw, h: ph }
        : null;
      const hit = !cancelled && (over(slab, 20) || over(pileCore, 8));
      if (hit && !s.committed) {
        s.committed = true; // повторне відпускання чи мультитач не спише двічі
        if (commitRef.current(s.kind)) {
          landRef.current(s.x, s.y, s.angle, s.grabU, s.grabV);
          return;
        }
      }
      // Поза ціллю — повертається без списання.
      s.phase = "return";
      wake();
    },
  });

  const keyboardTransfer = () => {
    const s = sim.current;
    if (done || s.phase !== "idle") return;
    onInteract();
    const tr = rel(trayRef.current);
    s.kind = mode;
    if (commit(mode) && tr) land(tr.cx, tr.cy, 0, 0.5, 0.5);
  };

  const stepNote = useMemo(() => {
    if (mode === "pack") {
      return plan.packs > 1
        ? `Стос: ${plan.packs} пачок по ${PACK_SIZE} купюр = ${label(plan.pack)}`
        : `Пачка = ${PACK_SIZE} × ${label(plan.bill)} = ${label(plan.pack)}`;
    }
    return `Купюра = ${label(plan.bill)}`;
  }, [mode, plan, label]);

  return (
    <div
      ref={rootRef}
      className="scene-surface relative flex h-full flex-col items-center gap-2 px-4 pb-1 pt-1"
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      />
      {ctx === null && (
        <p className="absolute inset-x-0 top-1/2 z-20 text-center text-sm text-mist">
          Анімація недоступна — скористайся кнопкою «Перенести».
        </p>
      )}

      {/* Сума — ціль */}
      <div className="relative z-0 flex w-full max-w-3xl flex-col items-center gap-1.5">
        <div
          ref={slabRef}
          className={cn(
            "relative w-full overflow-hidden rounded-[6px] px-4 py-6 text-center transition-[background-color,box-shadow,transform] duration-700 sm:py-9",
            done
              ? "bg-[#2a2d30]/50"
              : "bg-gradient-to-b from-[#34383b] to-[#1f2224]",
          )}
          style={{
            boxShadow: done
              ? "none"
              : "inset 0 1px 0 rgb(255 255 255 / .1), inset 0 -2px 0 rgb(0 0 0 / .35), 0 30px 60px -30px rgb(0 0 0 / .9)",
          }}
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
              color: "#eceeee",
              textShadow: done
                ? "0 0 40px rgb(200 205 208 / .2)"
                : "0 1px 0 #b9bfc2, 0 2px 0 #8b9296, 0 3px 0 #6c7377, 0 4px 0 #535a5e, 0 5px 0 #3e4448, 0 14px 24px rgb(0 0 0 / .6)",
              transition: "text-shadow 1.5s",
            }}
          >
            {label(total)}
          </span>
          {deltas.map((d) => (
            <span
              key={d.id}
              aria-hidden
              className="pointer-events-none absolute bottom-2 right-3 text-sm font-medium text-frost/85 motion-safe:animate-[debt-delta_1.4s_ease-out_forwards]"
              onAnimationEnd={() =>
                setDeltas((all) => all.filter((x) => x.id !== d.id))
              }
            >
              {d.text}
            </span>
          ))}
        </div>
        <p className="flex flex-wrap items-center justify-center gap-x-2 text-center text-xs text-mist">
          <span>Це уява. Реальний борг не змінюється.</span>
          {onEditInput && (
            <button
              type="button"
              onClick={onEditInput}
              className="min-h-8 text-frost/80 underline underline-offset-4 hover:text-frost"
            >
              Змінити суму
            </button>
          )}
        </p>
      </div>

      {/* Куди лягає перенесене — стопка одразу під сумою */}
      <div
        ref={pileRef}
        aria-hidden
        className="relative w-full shrink-0"
        style={{ height: noteH * PILE_SCALE + 30 }}
      />
      <div className="min-h-2 flex-1" />

      {/* Лоток */}
      {!done ? (
        <div className="relative z-20 flex w-full max-w-md flex-col items-center gap-2">
          <div
            ref={trayRef}
            aria-hidden
            className="cursor-grab active:cursor-grabbing"
            style={{ width: noteW + 24, height: noteH + 22 }}
          />
          <p className="text-center text-xs text-mist">{stepNote}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {plan.packMode && (
              <div
                role="radiogroup"
                aria-label="Як переносити"
                className="flex overflow-hidden rounded-[var(--radius-hair)] border border-steel/50"
              >
                {(["bill", "pack"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    disabled={m === "bill" && !plan.billMode}
                    title={
                      m === "bill" && !plan.billMode
                        ? "Забагато купюр — тут лише пачками"
                        : undefined
                    }
                    onClick={() => setMode(m)}
                    className={cn(
                      "min-h-11 px-3 text-sm disabled:opacity-40",
                      mode === m
                        ? "bg-frost text-abyss"
                        : "text-frost/80 hover:bg-night",
                    )}
                  >
                    {m === "bill" ? "По купюрі" : "Пачкою"}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={keyboardTransfer}
              className="scene-btn border border-steel/50"
            >
              Перенести {mode === "bill" ? "купюру" : "пачку"}
            </button>
          </div>
        </div>
      ) : (
        <p className="relative z-20 pb-2 text-center text-sm text-frost/80">
          Сума на нулі. Справжній борг не змінився — це була символічна вправа.
        </p>
      )}
    </div>
  );
}

function ease(t: number) {
  return 1 - Math.pow(1 - t, 3);
}
