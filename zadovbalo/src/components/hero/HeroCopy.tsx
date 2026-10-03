"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { useReveal } from "@/components/ui/motion";
import { StageHeading, StagePanel } from "@/components/flow/StagePanel";

/** Стан 1: «Задовбало?» на грозі. Мінімум тексту — одне питання й одна дія. */
export function HeroIntro({ onStart }: { onStart: () => void }) {
  const r = useReveal();
  // Вхід — CSS-анімацією (видно до гідратації), вихід — через Motion.
  const exitWord = r.word().exit;
  return (
    <StagePanel label="Початок" focusOnMount={false} className="gap-10 sm:gap-14">
      <motion.div initial={false} exit={exitWord} className="animate-fog-in">
        <StageHeading size="mega" className="tracking-[-0.04em]">
          Задовбало?
        </StageHeading>
      </motion.div>
      <motion.div initial={false} exit={{ opacity: 0, transition: { duration: 0.3 } }} className="animate-rise-in">
        <Button
          size="lg"
          variant="ghost"
          onClick={onStart}
          className="border-frost/60 px-12 text-[1.05rem] hover:bg-frost hover:text-abyss"
        >
          Почати
        </Button>
      </motion.div>
    </StagePanel>
  );
}

/** Стан 2: хмари розходяться. Точний текст із брифу. */
export function HeroExhale({ onWrite, onDictate }: { onWrite: () => void; onDictate: () => void }) {
  const r = useReveal();
  return (
    <StagePanel label="Видихни" className="gap-7 sm:gap-9">
      <motion.div {...r.word(0.15, 1.8)}>
        <StageHeading size="mega" className="italic tracking-[-0.03em]">
          Видихни.
        </StageHeading>
      </motion.div>

      <div className="flex max-w-xl flex-col items-center gap-3">
        <motion.p {...r.rise(0.95)} className="text-lede text-balance text-frost/90">
          Ну давай. Вивалюй усе, що накипіло.
        </motion.p>
        <motion.p {...r.rise(1.25)} className="text-sm tracking-[0.04em] text-mist">
          Матюкатись можна.
        </motion.p>
      </div>

      <motion.div {...r.rise(1.6)} className="mt-2 flex w-full max-w-md flex-wrap items-center justify-center gap-3">
        <Button size="lg" onClick={onWrite} className="min-w-[9.5rem] flex-1">
          Написати
        </Button>
        <Button size="lg" variant="ghost" onClick={onDictate} className="min-w-[9.5rem] flex-1">
          <MicIcon />
          Надиктувати
        </Button>
      </motion.div>
    </StagePanel>
  );
}

export function MicIcon({ className = "size-[1.1rem] shrink-0" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden className={className}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  );
}
