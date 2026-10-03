"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { useReveal } from "@/components/ui/motion";
import { StageHeading, StagePanel } from "@/components/flow/StagePanel";

export function Analyzing({ onCancel }: { onCancel: () => void }) {
  const r = useReveal();
  return (
    <StagePanel label="Визначаю тему" className="gap-8">
      <motion.div {...r.word(0, 1)}>
        <StageHeading size="giant" className="italic">
          Секунду.
        </StageHeading>
      </motion.div>
      <div role="status" className="flex flex-col items-center gap-5">
        <span className="text-lede text-frost/80">Дивлюся, що там найбільше тисне.</span>
        <span aria-hidden className="relative block h-px w-48 overflow-hidden bg-steel/40">
          {!r.reduced && (
            <motion.span
              className="absolute inset-y-0 left-0 w-1/3 bg-frost/80"
              animate={{ x: ["-100%", "300%"] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </span>
      </div>
      <Button variant="quiet" onClick={onCancel}>
        Скасувати
      </Button>
    </StagePanel>
  );
}
