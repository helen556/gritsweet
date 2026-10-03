"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { useReveal } from "@/components/ui/motion";
import { StageHeading, StagePanel } from "@/components/flow/StagePanel";
import { MicIcon } from "@/components/hero/HeroCopy";
import { MAX_TEXT_LENGTH, MIN_TEXT_LENGTH } from "@/lib/ai/schema";

export function RantInput({
  value,
  onChange,
  onSubmit,
  onDictate,
}: {
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  onDictate: () => void;
}) {
  const r = useReveal();
  const id = useId();
  const length = value.trim().length;
  const canSubmit = length >= MIN_TEXT_LENGTH && length <= MAX_TEXT_LENGTH;

  return (
    <StagePanel label="Написати" className="gap-6" focusOnMount={false}>
      <motion.div {...r.word(0, 1.1)}>
        <StageHeading size="giant">Ну?</StageHeading>
      </motion.div>

      <motion.form
        {...r.rise(0.25)}
        className="flex w-full max-w-2xl flex-col gap-4 text-left"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit();
        }}
      >
        <label htmlFor={id} className="sr-only">
          Що бісить
        </label>
        <div className="rounded-[var(--radius-hair)] border border-steel/55 bg-abyss/60 backdrop-blur-md transition-colors focus-within:border-frost/70">
          <textarea
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
                e.preventDefault();
                onSubmit();
              }
            }}
            maxLength={MAX_TEXT_LENGTH}
            rows={5}
            autoFocus
            spellCheck
            lang="uk"
            placeholder="Пиши як є. Без ком і без цензури."
            aria-describedby={`${id}-note`}
            className="field-sizing-content block max-h-[42dvh] min-h-36 w-full resize-none bg-transparent px-4 py-4 text-[1.0625rem] leading-relaxed text-frost placeholder:text-mist/60 sm:px-5 sm:text-lg"
          />
          <div className="flex items-center justify-between gap-3 border-t border-steel/30 px-4 py-2 text-xs text-mist/80 sm:px-5">
            <span id={`${id}-note`}>Текст іде тільки на розбір і ніде не зберігається.</span>
            <span aria-live="polite" className="tabular-nums">
              {length > MAX_TEXT_LENGTH * 0.8 ? `${length} / ${MAX_TEXT_LENGTH}` : ""}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="quiet" onClick={onDictate}>
            <MicIcon className="size-4 shrink-0" />
            Краще надиктую
          </Button>
          <Button type="submit" size="lg" disabled={!canSubmit} className="min-w-44">
            Вивалити
          </Button>
        </div>
      </motion.form>
    </StagePanel>
  );
}
