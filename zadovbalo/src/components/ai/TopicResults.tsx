"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { listStagger, useReveal } from "@/components/ui/motion";
import { StageHeading, StagePanel } from "@/components/flow/StagePanel";
import type { AnalyzedTopic } from "@/lib/ai/service";
import type { CategoryId } from "@/lib/topics/categories";
import { TopicChip } from "./TopicChip";

export function TopicResults({
  topics,
  completed,
  onSelect,
  onRewrite,
}: {
  topics: AnalyzedTopic[];
  completed: CategoryId[];
  onSelect: (category: CategoryId) => void;
  onRewrite: () => void;
}) {
  const r = useReveal();
  const single = topics.length === 1;
  const again = completed.length > 0;

  return (
    <StagePanel label="Що знайшлося" className="gap-8">
      <motion.div {...r.rise(0)}>
        <p className="text-lede text-frost/85">
          {again ? "Ще лишилось." : single ? "Я тут бачу одну річ." : "Я тут бачу кілька речей."}
        </p>
      </motion.div>

      <motion.ul
        variants={listStagger}
        initial="hidden"
        animate="show"
        className="flex max-w-3xl flex-wrap items-stretch justify-center gap-3"
        aria-label="Теми"
      >
        {topics.map((topic) => (
          <TopicChip
            key={topic.category}
            topic={topic}
            done={completed.includes(topic.category)}
            onSelect={() => onSelect(topic.category)}
          />
        ))}
      </motion.ul>

      <motion.div {...r.word(0.45, 1.1)}>
        <StageHeading size="title">{single ? "Почнемо?" : "З чого почнемо?"}</StageHeading>
      </motion.div>

      <motion.div {...r.rise(0.8)}>
        <Button variant="quiet" onClick={onRewrite}>
          Не те. Напишу інакше
        </Button>
      </motion.div>
    </StagePanel>
  );
}
