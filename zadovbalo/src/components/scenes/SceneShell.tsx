"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { sound } from "@/lib/scene/sound";
import type { SceneMeta } from "@/lib/scenes/registry";
import type { Intensity, SceneInput, SceneProps } from "./types";

const INTENSITY_LABEL: Record<Intensity, string> = { 1: "Мʼяко", 2: "Середньо", 3: "Сильно" };

/**
 * Спільна рамка сцени: заголовок, звук, інтенсивність, «Заново», «Інша дія», «Завершити».
 * Жодних балів, таймерів чи прогресу «успіху».
 */
export function SceneShell({
  meta,
  Scene,
  input,
  firstHint,
  withIntensity = false,
  onChangeAction,
  onFinish,
}: {
  meta: SceneMeta;
  Scene: React.ComponentType<SceneProps>;
  input: SceneInput;
  firstHint: string;
  withIntensity?: boolean;
  onChangeAction: () => void;
  onFinish: () => void;
}) {
  const reducedMotion = Boolean(useReducedMotion());
  const [runId, setRunId] = useState(0);
  const [intensity, setIntensity] = useState<Intensity>(2);
  const [soundOn, setSoundOn] = useState(sound.enabled);
  const [hint, setHint] = useState(firstHint);
  const [settled, setSettled] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  // Esc — завершити (клавіатурна альтернатива).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFinish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFinish]);

  const toggleSound = () => {
    if (sound.enabled) sound.disable();
    else sound.enable();
    setSoundOn(sound.enabled);
  };

  const restart = () => {
    setSettled(false);
    setHint(firstHint);
    setRunId((n) => n + 1);
  };

  const onSettled = useCallback(() => setSettled(true), []);

  return (
    <div className="scene-backdrop fixed inset-0 z-40 flex flex-col overflow-hidden text-frost" role="region" aria-label={meta.title}>
      <header className="safe-px safe-pt relative z-20 flex items-center justify-between gap-2 pb-2">
        <button type="button" onClick={onChangeAction} className="scene-btn shrink-0" aria-label="Інша дія">
          <span aria-hidden>←</span>
          <span className="hidden sm:inline">Інша дія</span>
        </button>
        <h1 ref={headingRef} tabIndex={-1} className="min-w-0 truncate px-1 text-center font-display text-lg italic outline-none sm:text-xl">
          {meta.title}
        </h1>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={soundOn}
            aria-label={soundOn ? "Вимкнути звук" : "Увімкнути звук"}
            className="scene-btn w-11 justify-center px-0"
          >
            <SoundIcon on={soundOn} />
          </button>
          <button type="button" onClick={restart} className="scene-btn" aria-label="Почати заново">
            <span aria-hidden>↺</span>
            <span className="hidden sm:inline">Заново</span>
          </button>
        </div>
      </header>

      <div className="relative z-10 min-h-0 flex-1">
        <Scene key={runId} input={input} intensity={intensity} reducedMotion={reducedMotion} onSettled={onSettled} setHint={setHint} />
      </div>

      <footer className="safe-px safe-pb relative z-20 flex flex-col items-center gap-3 pt-2">
        <p aria-live="polite" className="min-h-6 max-w-xl text-balance text-center text-sm text-frost/80 sm:text-base">
          {hint}
        </p>
        <div className="flex w-full max-w-xl flex-wrap items-center justify-center gap-2">
          {withIntensity && (
            <div role="radiogroup" aria-label="Інтенсивність" className="flex overflow-hidden rounded-[var(--radius-hair)] border border-steel/50">
              {([1, 2, 3] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={intensity === v}
                  onClick={() => setIntensity(v)}
                  className={cn("min-h-11 px-3 text-sm transition-colors", intensity === v ? "bg-frost text-abyss" : "text-frost/80 hover:bg-night")}
                >
                  {INTENSITY_LABEL[v]}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={onFinish} className={cn("scene-btn border", settled ? "border-frost bg-frost text-abyss hover:bg-white hover:text-abyss" : "border-steel/50")}>
            {settled ? "Готово" : "Завершити"}
          </button>
        </div>
      </footer>
    </div>
  );
}

function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
      {on ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
    </svg>
  );
}
