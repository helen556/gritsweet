"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { StageHeading, StagePanel } from "@/components/flow/StagePanel";

/**
 * Перший екран. Текст і дії видно одразу (CSS-анімація, без очікування JS, відео чи WebGL).
 */
export function HeroFirst({ onWrite, onDictate, onManual }: { onWrite: () => void; onDictate: () => void; onManual: () => void }) {
  const exit = { opacity: 0, filter: "blur(12px)", transition: { duration: 0.6 } };
  return (
    <StagePanel label="Видихни" focusOnMount={false} visibleOnLoad className="gap-7 sm:gap-9">
      <motion.div initial={false} exit={exit} className="animate-fog-in">
        <StageHeading size="mega" className="italic tracking-[-0.03em]">
          Видихни.
        </StageHeading>
      </motion.div>

      <motion.div initial={false} exit={exit} className="animate-rise-in flex max-w-xl flex-col items-center gap-3">
        <p className="text-lede text-balance text-frost/90">Ну давай. Вивалюй усе, що накипіло.</p>
        <p className="text-sm tracking-[0.04em] text-mist">Матюкатись можна.</p>
      </motion.div>

      <motion.div initial={false} exit={{ opacity: 0, transition: { duration: 0.3 } }} className="animate-rise-in mt-1 flex w-full max-w-md flex-col items-center gap-4">
        <div className="flex w-full flex-wrap items-center justify-center gap-3">
          <Button size="lg" onClick={onWrite} className="min-w-[9.5rem] flex-1">
            Написати
          </Button>
          <Button size="lg" variant="ghost" onClick={onDictate} className="min-w-[9.5rem] flex-1">
            <MicIcon />
            Надиктувати
          </Button>
        </div>
        <Button variant="quiet" onClick={onManual} className="text-sm">
          Обрати дію без тексту
        </Button>
        <p className="max-w-sm text-balance text-xs leading-relaxed text-mist/80">
          Простір символічних дій, щоб перепочити: змʼяти, розплутати, відклеїти те, що тисне. Без реєстрації.
        </p>
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
