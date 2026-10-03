"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { useReveal } from "@/components/ui/motion";
import { StageHeading, StagePanel } from "./StagePanel";

/** Після механіки: «Одним стало менше.» → «Ще бісить?» */
export function DonePanel({
  doneLine,
  kept,
  hasMore,
  onMore,
  onEnough,
}: {
  doneLine: string;
  kept: string[];
  hasMore: boolean;
  onMore: () => void;
  onEnough: () => void;
}) {
  const r = useReveal();
  return (
    <StagePanel label="Готово" className="gap-7">
      <motion.p {...r.rise(0)} className="text-lede text-frost/85">
        Одним стало менше.
      </motion.p>
      <motion.p {...r.rise(0.25)} className="max-w-xl text-balance font-display text-2xl italic text-frost sm:text-3xl">
        {doneLine}
      </motion.p>
      {kept.length > 0 && (
        <motion.ul {...r.rise(0.4)} aria-label="Залишилось" className="flex flex-wrap justify-center gap-2">
          {kept.map((k) => (
            <li key={k} className="rounded-[var(--radius-hair)] border border-tide/70 px-4 py-1.5 text-frost">
              {k}
            </li>
          ))}
        </motion.ul>
      )}
      <motion.div {...r.word(0.7, 1.2)}>
        <StageHeading size="giant">Ще бісить?</StageHeading>
      </motion.div>
      <motion.div {...r.rise(1)} className="flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" onClick={onMore} className="min-w-40">
          {hasMore ? "Так, далі" : "Так, ще є"}
        </Button>
        <Button size="lg" variant="ghost" onClick={onEnough}>
          На сьогодні досить.
        </Button>
      </motion.div>
    </StagePanel>
  );
}

export function FinishedPanel({ onRestart }: { onRestart: () => void }) {
  const r = useReveal();
  return (
    <StagePanel label="Кінець" className="gap-8">
      <motion.p {...r.rise(0)} className="text-lede text-frost/85">
        На сьогодні досить.
      </motion.p>
      <motion.div {...r.word(0.3, 1.8)}>
        <StageHeading size="mega" className="italic">
          Видихни.
        </StageHeading>
      </motion.div>
      <motion.div {...r.rise(1.2)}>
        <Button variant="quiet" onClick={onRestart}>
          Почати спочатку
        </Button>
      </motion.div>
    </StagePanel>
  );
}
