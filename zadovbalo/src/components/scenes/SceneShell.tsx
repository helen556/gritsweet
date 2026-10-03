"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { sound } from "@/lib/scene/sound";
import type { SceneMeta } from "@/lib/scenes/registry";
import type { SceneInput, SceneProps } from "./types";

export type SceneExit = "change" | "write" | "enough";

/**
 * Спільна рамка сцени: вступ, підказка, «Змінити сцену», «Заново», «Завершити», звук.
 * «Завершити» відкриває мʼяке завершення поверх сцени — сцену можна продовжити.
 * Жодних балів, таймерів чи примусу дійти до кінця.
 */
export function SceneShell({
  meta,
  Scene,
  input,
  topicNote,
  onExit,
  onEditInput,
}: {
  meta: SceneMeta;
  Scene: React.ComponentType<SceneProps>;
  input: SceneInput;
  /** «Тему визначено …» — з кнопкою змінити. */
  topicNote?: string | null;
  onExit: (kind: SceneExit) => void;
  onEditInput?: () => void;
}) {
  const reducedMotion = Boolean(useReducedMotion());
  const [runId, setRunId] = useState(0);
  const [soundOn, setSoundOn] = useState(sound.enabled);
  const [hint, setHint] = useState(meta.hint);
  const [settled, setSettled] = useState(false);
  const [introOpen, setIntroOpen] = useState(true);
  const [outro, setOutro] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  // Вступ згортається сам за кілька секунд або з першим дотиком.
  useEffect(() => {
    if (!introOpen) return;
    const t = window.setTimeout(() => setIntroOpen(false), 9000);
    return () => window.clearTimeout(t);
  }, [introOpen]);

  // Esc — завершення (клавіатурна альтернатива), повторно — закрити панель.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea")) return;
      setOutro((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleSound = () => {
    if (sound.enabled) sound.disable();
    else sound.enable();
    setSoundOn(sound.enabled);
  };

  const restart = () => {
    setSettled(false);
    setHint(meta.hint);
    setOutro(false);
    setRunId((n) => n + 1);
  };

  const onSettled = useCallback(() => setSettled(true), []);
  const onInteract = useCallback(() => setIntroOpen(false), []);
  const openOutro = useCallback(() => setOutro(true), []);

  return (
    <motion.div
      className="scene-backdrop fixed inset-0 z-40 flex flex-col overflow-hidden text-frost"
      role="region"
      aria-label={meta.title}
      initial={
        reducedMotion
          ? { opacity: 0 }
          : { opacity: 0, clipPath: "inset(14% 10% 14% 10% round 28px)" }
      }
      animate={
        reducedMotion
          ? { opacity: 1 }
          : { opacity: 1, clipPath: "inset(0% 0% 0% 0% round 0px)" }
      }
      exit={
        reducedMotion
          ? { opacity: 0 }
          : {
              opacity: 0,
              clipPath: "inset(10% 8% 10% 8% round 28px)",
              transition: { duration: 0.45 },
            }
      }
      transition={{
        duration: reducedMotion ? 0.25 : 0.8,
        ease: [0.22, 0.61, 0.36, 1],
      }}
    >
      {/* Світло «вмикається», коли входимо: мʼяка смуга зверху вниз, без спалаху. */}
      {!reducedMotion && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-30"
          initial={{
            opacity: 0.85,
            background:
              "linear-gradient(180deg, rgb(15 18 20) 0%, rgb(15 18 20) 100%)",
          }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      )}

      <header className="safe-px safe-pt relative z-20 flex items-center justify-between gap-2 pb-1">
        <button
          type="button"
          onClick={() => onExit("change")}
          className="scene-btn min-w-11 shrink-0 justify-center"
          aria-label="Змінити сцену"
        >
          <span aria-hidden>←</span>
          <span className="hidden sm:inline">Змінити сцену</span>
        </button>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="min-w-0 truncate px-1 text-center font-display text-lg italic outline-none sm:text-xl"
        >
          {meta.title}
        </h1>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setIntroOpen((o) => !o)}
            aria-expanded={introOpen}
            aria-label="Що тут робити?"
            className="scene-btn w-11 justify-center px-0"
          >
            <span
              aria-hidden
              className="grid size-5 place-items-center rounded-full border border-current text-[0.7rem] font-semibold"
            >
              ?
            </span>
          </button>
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={soundOn}
            aria-label={soundOn ? "Вимкнути звук" : "Увімкнути звук"}
            className="scene-btn w-11 justify-center px-0"
          >
            <SoundIcon on={soundOn} />
          </button>
          <button
            type="button"
            onClick={restart}
            className="scene-btn min-w-11 justify-center"
            aria-label="Почати заново"
          >
            <span aria-hidden>↺</span>
            <span className="hidden sm:inline">Заново</span>
          </button>
        </div>
      </header>

      {/* Вступ лежить поверх сцени: коли згортається, розмір сцени не змінюється посеред жесту. */}
      <div className="relative z-10 min-h-0 flex-1">
        {/* Вступ (і звідки тема) — поверх сцени, лише доки людина не почала дію; потім нічого не перекриває предметів. */}
        <AnimatePresence>
          {introOpen && (
            <motion.div
              key="intro"
              className="safe-px pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center gap-1.5 pb-8 pt-1 text-center [&_button]:pointer-events-auto"
              style={{
                background:
                  "linear-gradient(180deg, rgb(28 30 32 / 0.94) 0%, rgb(28 30 32 / 0.8) 62%, transparent 100%)",
              }}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={{
                duration: reducedMotion ? 0.2 : 0.55,
                delay: reducedMotion ? 0 : 0.3,
              }}
            >
              <p className="max-w-2xl text-balance text-[1.02rem] leading-snug text-frost/90 sm:text-lg">
                {meta.intro}
              </p>
              {topicNote && (
                <p className="flex flex-wrap items-center justify-center gap-x-2 text-xs text-mist">
                  <span>{topicNote}</span>
                  <button
                    type="button"
                    onClick={() => onExit("change")}
                    className="min-h-8 text-frost/85 underline underline-offset-4 hover:text-frost"
                  >
                    Змінити тему
                  </button>
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <Scene
          key={runId}
          input={input}
          reducedMotion={reducedMotion}
          onSettled={onSettled}
          setHint={setHint}
          onInteract={onInteract}
          onFinish={openOutro}
          onEditInput={onEditInput}
        />
      </div>

      <footer className="safe-px safe-pb relative z-20 flex flex-col items-center gap-2 pt-1">
        <p
          aria-live="polite"
          className="min-h-6 max-w-xl text-balance text-center text-sm text-frost/85 sm:text-base"
        >
          {hint}
        </p>
        <button
          type="button"
          onClick={() => setOutro(true)}
          className={cn(
            "scene-btn border",
            settled
              ? "border-frost bg-frost text-abyss hover:bg-white hover:text-abyss"
              : "border-steel/60",
          )}
        >
          Завершити
        </button>
      </footer>

      <AnimatePresence>
        {outro && (
          <Outro
            meta={meta}
            reducedMotion={reducedMotion}
            onContinue={() => setOutro(false)}
            onExit={onExit}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Мʼяке завершення: питання сцени, необовʼязкова відповідь (лише в памʼяті), без «успіху». */
function Outro({
  meta,
  reducedMotion,
  onContinue,
  onExit,
}: {
  meta: SceneMeta;
  reducedMotion: boolean;
  onContinue: () => void;
  onExit: (k: SceneExit) => void;
}) {
  const id = useId();
  const [note, setNote] = useState("");
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-end justify-center bg-[rgb(12_13_14/0.72)] backdrop-blur-[3px] sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.15 : 0.45 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-t`}
    >
      <motion.div
        className="safe-pb m-0 flex w-full max-w-xl flex-col gap-5 rounded-t-[14px] border border-steel/50 bg-night/95 px-5 pt-6 shadow-[0_-30px_60px_-30px_rgb(0_0_0/0.9)] sm:m-6 sm:rounded-[10px] sm:pb-6"
        initial={reducedMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reducedMotion ? { opacity: 0 } : { y: 30, opacity: 0 }}
        transition={{
          duration: reducedMotion ? 0.15 : 0.55,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        <h2
          id={`${id}-t`}
          ref={ref}
          tabIndex={-1}
          className="font-display text-[1.7rem] leading-tight text-balance outline-none sm:text-3xl"
        >
          {meta.outro}
        </h2>
        {meta.outroNote && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-n`} className="text-sm text-frost/80">
              {meta.outroNote}
            </label>
            <textarea
              id={`${id}-n`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={300}
              className="w-full resize-none rounded-[var(--radius-hair)] border border-steel/55 bg-abyss/70 px-3 py-2 text-frost focus-visible:border-frost/80"
            />
            <p className="text-xs text-mist">
              Лишається тільки на цьому екрані: нікуди не надсилається й не
              зберігається.
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pb-1">
          <button
            type="button"
            onClick={onContinue}
            className="scene-btn border border-frost bg-frost text-abyss hover:bg-white hover:text-abyss"
          >
            Побути ще тут
          </button>
          <button
            type="button"
            onClick={() => onExit("change")}
            className="scene-btn border border-steel/60"
          >
            Інша сцена
          </button>
          <button
            type="button"
            onClick={() => onExit("write")}
            className="scene-btn border border-steel/60"
          >
            Написати ще
          </button>
          <button
            type="button"
            onClick={() => onExit("enough")}
            className="scene-btn border border-steel/60"
          >
            На сьогодні досить
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
      {on ? (
        <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
      ) : (
        <path d="M16 9.5l5 5M21 9.5l-5 5" />
      )}
    </svg>
  );
}
