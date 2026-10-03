"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { useReveal } from "@/components/ui/motion";
import type { ClientAnalyzeError } from "@/lib/ai/client";
import { StageHeading, StagePanel } from "./StagePanel";

const COPY: Record<ClientAnalyzeError, { title: string; text: string }> = {
  network: { title: "Щось зависло. Не ти — сайт.", text: "Схоже, зник інтернет. Текст нікуди не дівся." },
  timeout: { title: "Щось зависло. Не ти — сайт.", text: "Розбір затягнувся. Текст нікуди не дівся." },
  ai_unavailable: { title: "Щось зависло. Не ти — сайт.", text: "Розбір зараз не працює. Текст нікуди не дівся." },
  invalid_response: { title: "Щось зависло. Не ти — сайт.", text: "Розбір видав щось дивне. Спробуймо ще раз." },
  rate_limited: { title: "Забагато за раз.", text: "Видихни хвилинку — і спробуй знову." },
  invalid_input: { title: "Замало слів.", text: "Напиши хоч кілька — і поїхали." },
};

export function ErrorPanel({ error, onRetry, onEdit }: { error: ClientAnalyzeError; onRetry: () => void; onEdit: () => void }) {
  const r = useReveal();
  const copy = COPY[error];
  return (
    <StagePanel label="Помилка" className="gap-7">
      <motion.div {...r.word(0, 1)}>
        <StageHeading size="title" className="max-w-2xl">
          {copy.title}
        </StageHeading>
      </motion.div>
      <motion.p {...r.rise(0.3)} className="text-lede text-frost/80">
        {copy.text}
      </motion.p>
      <motion.div {...r.rise(0.5)} className="flex flex-wrap items-center justify-center gap-3">
        {error !== "invalid_input" && (
          <Button size="lg" onClick={onRetry}>
            Спробувати ще раз
          </Button>
        )}
        <Button variant={error === "invalid_input" ? "primary" : "quiet"} size="lg" onClick={onEdit}>
          Змінити текст
        </Button>
      </motion.div>
    </StagePanel>
  );
}
