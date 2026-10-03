"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import type { AnalyzedTopic } from "@/lib/ai/service";

export function TopicChip({ topic, onSelect, done }: { topic: AnalyzedTopic; onSelect: () => void; done?: boolean }) {
  return (
    <motion.li
      variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } } }}
      className="list-none"
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={done}
        aria-label={`${topic.label.toLowerCase()}, сила ${topic.intensity} з 10${done ? ", вже розібрано" : ""}`}
        className={cn(
          "group flex min-h-14 flex-col items-start justify-center gap-1.5 rounded-[var(--radius-hair)] border px-5 py-3 text-left",
          "border-mist/40 bg-abyss/45 backdrop-blur-sm transition-[border-color,background-color,transform] duration-200",
          "hover:-translate-y-0.5 hover:border-frost hover:bg-abyss/70 active:translate-y-0",
          "disabled:pointer-events-none disabled:opacity-40",
        )}
      >
        <span className={cn("font-sans text-[0.95rem] font-semibold tracking-[0.16em] text-frost", done && "line-through")}>
          {topic.label}
        </span>
        {/* Сила — штрихами й числом, не лише кольором */}
        <span aria-hidden className="flex items-center gap-[3px]">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={cn("h-1 w-2 rounded-[1px]", i < topic.intensity ? "bg-frost/80" : "bg-steel/45")} />
          ))}
          <span className="ml-2 text-[0.7rem] tabular-nums text-mist">{topic.intensity}/10</span>
        </span>
      </button>
    </motion.li>
  );
}
