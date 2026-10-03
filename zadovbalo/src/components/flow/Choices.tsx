"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { listStagger, useReveal } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { confirmPhrase } from "@/lib/ai/phrases";
import type { ClientReason } from "@/lib/ai/client";
import type { Analysis } from "@/lib/ai/service";
import { CATEGORY_SCENES, SCENES, type SceneId } from "@/lib/scenes/registry";
import { CATEGORY_COPY, MANUAL_CATEGORIES, type Category } from "@/lib/topics";
import { StageHeading, StagePanel } from "./StagePanel";

const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } } };

function Chip({ active, onClick, children, tag }: { active?: boolean; onClick: () => void; children: React.ReactNode; tag?: string }) {
  return (
    <motion.li variants={item} className="list-none">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          "flex min-h-11 items-center gap-2 rounded-[var(--radius-hair)] border px-4 py-2 text-sm transition-colors",
          active ? "border-frost bg-frost text-abyss" : "border-mist/40 bg-abyss/50 text-frost hover:border-frost",
        )}
      >
        {children}
        {tag && <span className={cn("text-[0.7rem] uppercase tracking-[0.12em]", active ? "text-abyss/70" : "text-mist")}>{tag}</span>}
      </button>
    </motion.li>
  );
}

function SceneCard({ id, onChoose }: { id: SceneId; onChoose: (id: SceneId) => void }) {
  const s = SCENES[id];
  return (
    <motion.li variants={item} className="list-none">
      <button
        type="button"
        onClick={() => onChoose(id)}
        className="group flex min-h-20 w-full flex-col items-start gap-1 rounded-[var(--radius-edge)] border border-steel/55 bg-gradient-to-b from-slate/70 to-night/80 px-5 py-4 text-left shadow-[0_20px_40px_-28px_rgb(0_0_0/0.9)] transition-[border-color,transform] hover:-translate-y-0.5 hover:border-frost/70"
      >
        <span className="font-display text-xl text-frost">{s.title}</span>
        <span className="text-sm text-frost/70">{s.action}</span>
      </button>
    </motion.li>
  );
}

export function Confirm({
  analysis,
  category,
  onCategory,
  onScene,
  onOther,
  detected = true,
}: {
  analysis: Analysis;
  category: Category;
  /** false — тему обрала людина; тоді без «Схоже, …». */
  detected?: boolean;
  onCategory: (c: Category) => void;
  onScene: (id: SceneId) => void;
  onOther: () => void;
}) {
  const r = useReveal();
  const topics = analysis.categories.filter((c) => c !== "needs_support");
  const order = [...analysis.sceneIds, ...CATEGORY_SCENES[category]];
  const scenes = [...new Set(order)].filter((s) => CATEGORY_SCENES[category].includes(s));
  return (
    <StagePanel label="З чого почнемо" className="gap-7">
      {detected && (
        <motion.p {...r.rise(0)} className="text-lede max-w-2xl text-balance text-frost/90">
          {confirmPhrase(analysis.categories, analysis.primaryCategory ?? category)}
        </motion.p>
      )}
      <motion.ul variants={listStagger} initial="hidden" animate="show" className="flex flex-wrap justify-center gap-2" aria-label="Теми">
        {topics.map((c) => (
          <Chip key={c} active={c === category} onClick={() => onCategory(c)}>
            {CATEGORY_COPY[c].label}
          </Chip>
        ))}
        <Chip onClick={onOther}>{detected ? "Інша тема" : "Змінити тему"}</Chip>
      </motion.ul>
      <motion.div {...r.word(0.25, 1)}>
        <StageHeading size="title">З чого почнемо?</StageHeading>
      </motion.div>
      <motion.ul variants={listStagger} initial="hidden" animate="show" className="grid w-full max-w-2xl gap-3 sm:grid-cols-2" aria-label="Дії">
        {scenes.map((id) => (
          <SceneCard key={id} id={id} onChoose={onScene} />
        ))}
      </motion.ul>
    </StagePanel>
  );
}

export function Clarify({ categories, onCategory, onOther }: { categories: Category[]; onCategory: (c: Category) => void; onOther: () => void }) {
  const r = useReveal();
  return (
    <StagePanel label="Уточнення" className="gap-7">
      <motion.div {...r.word(0, 1)}>
        <StageHeading size="title">Про що це більше?</StageHeading>
      </motion.div>
      <motion.ul variants={listStagger} initial="hidden" animate="show" className="flex max-w-2xl flex-wrap justify-center gap-2">
        {categories
          .filter((c) => c !== "needs_support")
          .map((c) => (
            <Chip key={c} onClick={() => onCategory(c)}>
              {CATEGORY_COPY[c].label}
            </Chip>
          ))}
        <Chip onClick={onOther}>Щось інше</Chip>
      </motion.ul>
    </StagePanel>
  );
}

const REASON_COPY: Partial<Record<ClientReason, string>> = {
  not_configured: "Автоматичне визначення теми зараз вимкнене.",
  offline: "Схоже, немає інтернету. Сцени працюють і без нього.",
  rate_limited: "Забагато запитів за короткий час. Обери тему вручну — так навіть швидше.",
  quota: "Ліміт автоматичних визначень на сьогодні вичерпано.",
  budget: "Ліміт автоматичних визначень на сьогодні вичерпано.",
};

export function Manual({
  reason,
  suggestions,
  onCategory,
  onSupport,
}: {
  reason: ClientReason | null;
  suggestions: Category[];
  onCategory: (c: Category) => void;
  onSupport: () => void;
}) {
  const r = useReveal();
  const note = reason ? (REASON_COPY[reason] ?? "Тему не вдалося визначити автоматично.") : null;
  return (
    <StagePanel label="Ручний вибір" className="gap-6">
      <motion.div {...r.word(0, 1)} className="flex flex-col items-center gap-3">
        <StageHeading size="title">Що зараз найближче?</StageHeading>
        {note && <p className="text-sm text-mist">{note}</p>}
      </motion.div>
      <motion.ul variants={listStagger} initial="hidden" animate="show" className="grid w-full max-w-2xl gap-2 sm:grid-cols-2" aria-label="Теми">
        {MANUAL_CATEGORIES.map((c) => {
          const hinted = suggestions.includes(c);
          return (
            <motion.li key={c} variants={item} className="list-none">
              <button
                type="button"
                onClick={() => onCategory(c)}
                className={cn(
                  "flex min-h-16 w-full flex-col items-start justify-center gap-0.5 rounded-[var(--radius-edge)] border px-4 py-3 text-left transition-colors",
                  hinted ? "border-tide bg-night/80" : "border-steel/50 bg-abyss/55 hover:border-frost/70",
                )}
              >
                <span className="flex items-center gap-2 font-medium text-frost">
                  {CATEGORY_COPY[c].label}
                  {hinted && <span className="text-[0.68rem] font-normal uppercase tracking-[0.1em] text-tide">за ключовими словами</span>}
                </span>
                <span className="text-sm text-frost/65">{CATEGORY_COPY[c].hint}</span>
              </button>
            </motion.li>
          );
        })}
      </motion.ul>
      <Button variant="quiet" onClick={onSupport}>
        Мені зараз дуже важко
      </Button>
    </StagePanel>
  );
}

export function WarChoice({ onAnger, onQuiet }: { onAnger: () => void; onQuiet: () => void }) {
  const r = useReveal();
  return (
    <StagePanel label="Що зараз потрібно" className="gap-7">
      <motion.div {...r.word(0, 1)}>
        <StageHeading size="title">Що зараз потрібно?</StageHeading>
      </motion.div>
      <motion.p {...r.rise(0.2)} className="max-w-xl text-balance text-frost/75">
        Якщо війна зараз більше про страх чи втрату, тихіша дія може бути доречнішою.
      </motion.p>
      <motion.div {...r.rise(0.35)} className="grid w-full max-w-xl gap-3 sm:grid-cols-2">
        <button type="button" onClick={onAnger} className="min-h-20 rounded-[var(--radius-edge)] border border-steel/55 bg-night/70 px-5 py-4 text-left hover:border-frost/70">
          <span className="block font-display text-xl">Виплеснути злість</span>
          <span className="text-sm text-frost/70">Символічна карта: рвати, палити, знищити</span>
        </button>
        <button type="button" onClick={onQuiet} className="min-h-20 rounded-[var(--radius-edge)] border border-steel/55 bg-night/70 px-5 py-4 text-left hover:border-frost/70">
          <span className="block font-display text-xl">Щось тихіше</span>
          <span className="text-sm text-frost/70">Пісок і вода, без потреби щось завершувати</span>
        </button>
      </motion.div>
    </StagePanel>
  );
}

export function Finish({ onOther, onWriteMore, onEnough }: { onOther: () => void; onWriteMore: () => void; onEnough: () => void }) {
  const r = useReveal();
  return (
    <StagePanel label="Завершення" className="gap-7">
      <motion.div {...r.word(0, 1.6)}>
        <StageHeading size="giant" className="italic">
          Видихни.
        </StageHeading>
      </motion.div>
      <motion.p {...r.rise(0.6)} className="text-lede max-w-xl text-balance text-frost/80">
        Можна ще трохи побути тут. Або повернутися пізніше.
      </motion.p>
      <motion.div {...r.rise(0.9)} className="flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" variant="ghost" onClick={onOther}>
          Інша дія
        </Button>
        <Button size="lg" variant="ghost" onClick={onWriteMore}>
          Написати ще
        </Button>
        <Button size="lg" onClick={onEnough}>
          На сьогодні досить
        </Button>
      </motion.div>
    </StagePanel>
  );
}
