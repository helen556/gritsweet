"use client";

import { AnimatePresence, motion, useMotionValue, useTransform, animate, type PanInfo } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { MechanicProps } from "./types";

interface Card {
  id: number;
  text: string;
}

const FLING_DISTANCE = 110;
const FLING_VELOCITY = 550;

/**
 * Стос карток: тягни/кидай геть, кнопкою «Залишити» — відкладай потрібне.
 * Завершується, коли стос порожній або лишилось рівно стільки, скільки треба зберегти.
 */
export default function SwipeMechanic({ scenario, items, hint, keep, variant, reducedMotion, onComplete }: MechanicProps) {
  const initial = useMemo<Card[]>(() => items.map((text, id) => ({ id, text })), [items]);
  const target = Math.min(keep, Math.max(0, initial.length - 1));
  const [stack, setStack] = useState(initial);
  const [kept, setKept] = useState<string[]>([]);
  const [lastExit, setLastExit] = useState<{ x: number; y: number }>({ x: 1, y: 0 });
  const [announcement, setAnnouncement] = useState("");
  const finished = useRef(false);

  const finish = useCallback(
    (keptItems: string[]) => {
      if (finished.current) return;
      finished.current = true;
      // Даємо останній картці відлетіти.
      window.setTimeout(() => onComplete(keptItems), reducedMotion ? 150 : 650);
    },
    [onComplete, reducedMotion],
  );

  useEffect(() => {
    if (finished.current) return;
    if (stack.length === 0) finish(kept);
    else if (target > 0 && kept.length + stack.length <= target) finish([...kept, ...stack.map((c) => c.text)]);
    else if (target > 0 && kept.length >= target) finish(kept);
  }, [stack, kept, target, finish]);

  const removeTop = useCallback(
    (direction: { x: number; y: number }) => {
      const top = stack[0];
      if (!top) return;
      setLastExit(direction);
      setStack(stack.slice(1));
      setAnnouncement(`Прибрано: ${top.text}. Ще ${stack.length - 1}.`);
    },
    [stack],
  );

  const keepTop = useCallback(() => {
    const top = stack[0];
    if (!top) return;
    setLastExit({ x: 0, y: 1 });
    setStack(stack.slice(1));
    setKept((k) => [...k, top.text]);
    setAnnouncement(`Залишено: ${top.text}.`);
  }, [stack]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (["ArrowLeft", "ArrowRight", "Delete", "Backspace"].includes(e.key)) {
      e.preventDefault();
      removeTop({ x: e.key === "ArrowLeft" ? -1 : 1, y: 0 });
    } else if (target > 0 && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      keepTop();
    }
  };

  const remainingToRemove = Math.max(0, stack.length + kept.length - target);

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div
        role="group"
        tabIndex={0}
        aria-roledescription="стос карток"
        aria-label={`${hint} Стрілки вліво чи вправо — прибрати${target > 0 ? ", Enter — залишити" : ""}.`}
        onKeyDown={onKeyDown}
        className="relative mt-4 h-[min(44dvh,21rem)] w-[min(86vw,24rem)] outline-none focus-visible:outline-2 focus-visible:outline-offset-8"
      >
        <AnimatePresence custom={lastExit}>
          {stack
            .slice(0, 4)
            .reverse()
            .map((card) => {
              const depth = stack.indexOf(card);
              return (
                <SwipeCard
                  key={card.id}
                  card={card}
                  depth={depth}
                  label={scenario.label}
                  freeAxis={variant === "dismiss"}
                  reducedMotion={reducedMotion}
                  onFling={removeTop}
                />
              );
            })}
        </AnimatePresence>
        {stack.length === 0 && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 grid place-items-center font-display text-2xl italic text-mist">
            Пусто.
          </motion.p>
        )}
      </div>

      <p className="text-sm tabular-nums text-mist" aria-hidden>
        {target > 0 ? `Прибрати ще ${remainingToRemove} · залишити ${target}` : `Ще ${stack.length}`}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" variant="ghost" disabled={stack.length === 0} onClick={() => removeTop({ x: 1, y: 0 })} className="min-w-40">
          Геть
        </Button>
        {target > 0 && (
          <Button size="lg" variant="quiet" disabled={stack.length === 0} onClick={keepTop}>
            Залишити це
          </Button>
        )}
      </div>

      {kept.length > 0 && (
        <ul aria-label="Залишено" className="flex flex-wrap justify-center gap-2 text-sm text-frost/85">
          {kept.map((k) => (
            <li key={k} className="rounded-[var(--radius-hair)] border border-tide/60 px-3 py-1">
              {k}
            </li>
          ))}
        </ul>
      )}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

function SwipeCard({
  card,
  depth,
  label,
  freeAxis,
  reducedMotion,
  onFling,
}: {
  card: Card;
  depth: number;
  label: string;
  freeAxis: boolean;
  reducedMotion: boolean;
  onFling: (direction: { x: number; y: number }) => void;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-260, 260], [-14, 14]);
  const isTop = depth === 0;

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    const distance = Math.hypot(offset.x, freeAxis ? offset.y : 0);
    const speed = Math.hypot(velocity.x, freeAxis ? velocity.y : 0);
    if (distance > FLING_DISTANCE || speed > FLING_VELOCITY) {
      const dx = offset.x + velocity.x * 0.2;
      const dy = freeAxis ? offset.y + velocity.y * 0.2 : 0;
      const len = Math.hypot(dx, dy) || 1;
      onFling({ x: dx / len, y: dy / len });
    } else {
      void animate(x, 0, { type: "spring", stiffness: 420, damping: 32 });
      void animate(y, 0, { type: "spring", stiffness: 420, damping: 32 });
    }
  };

  return (
    <motion.div
      className={cn(
        "absolute inset-0 flex select-none flex-col justify-between rounded-[var(--radius-edge)] border p-6 text-left",
        "border-steel/55 bg-night bg-gradient-to-br from-slate via-night to-abyss shadow-[0_40px_80px_-40px_rgb(0_0_0/0.9)]",
        isTop ? "cursor-grab active:cursor-grabbing" : "pointer-events-none",
      )}
      style={{ x, y, rotate, zIndex: 10 - depth, touchAction: isTop ? "none" : "auto" }}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 24 }}
      animate={{
        opacity: depth > 2 ? 0 : 1,
        scale: reducedMotion ? 1 : 1 - depth * 0.05,
        translateY: reducedMotion ? 0 : depth * -14,
        filter: depth > 0 ? "brightness(0.7)" : "brightness(1)",
      }}
      exit={reducedMotion ? { opacity: 0, transition: { duration: 0.15 } } : "fling"}
      variants={{
        fling: (dir: { x: number; y: number }) => ({
          x: dir.x * 900,
          y: dir.y * 700,
          rotate: dir.x * 28,
          opacity: 0,
          transition: { duration: 0.55, ease: [0.4, 0, 1, 1] },
        }),
      }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      drag={isTop ? (freeAxis ? true : "x") : false}
      dragElastic={0.7}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      aria-hidden={!isTop}
    >
      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-mist/80">{label}</span>
      <span className="font-display text-[clamp(1.9rem,7vw,2.75rem)] font-medium leading-[1.05] text-balance text-frost">{card.text}</span>
      <span aria-hidden className="text-xs text-mist/70">
        {isTop ? "← тягни геть →" : ""}
      </span>
    </motion.div>
  );
}
