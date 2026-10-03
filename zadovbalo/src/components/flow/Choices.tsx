"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { listStagger, useReveal } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { confirmPhrase } from "@/lib/ai/phrases";
import type { ClientReason } from "@/lib/ai/client";
import type { WarMood } from "@/lib/ai/route";
import { CATEGORY_SCENES, SCENE_CATEGORY, SCENE_IDS, SCENES, WAR_QUIET_SCENES, type SceneId } from "@/lib/scenes/registry";
import { CATEGORY_COPY, type Category } from "@/lib/topics";
import type { TopicSource } from "./state";
import { StageHeading, StagePanel } from "./StagePanel";

const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } } };

function SceneCard({ id, onChoose, note }: { id: SceneId; onChoose: (id: SceneId) => void; note?: string }) {
  const s = SCENES[id];
  return (
    <motion.li variants={item} className="list-none">
      <button
        type="button"
        onClick={() => onChoose(id)}
        className="group flex min-h-20 w-full flex-col items-start gap-1 rounded-[var(--radius-edge)] border border-steel/55 bg-gradient-to-b from-slate/70 to-night/85 px-5 py-4 text-left shadow-[0_20px_40px_-28px_rgb(0_0_0/0.9)] transition-[border-color,transform] hover:-translate-y-0.5 hover:border-frost/70"
      >
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-xl text-frost">{s.title}</span>
          {note && <span className="text-[0.68rem] uppercase tracking-[0.1em] text-tide">{note}</span>}
        </span>
        <span className="text-sm text-frost/70">{s.action}</span>
      </button>
    </motion.li>
  );
}

const SOURCE_NOTE: Record<TopicSource, string | null> = {
  ai: "Теми визначено автоматично.",
  local: "Теми підібрано за словами в тексті.",
  manual: null,
};

/** Кілька тем або «просто накипіло» — один короткий вибір. */
export function Choose({
  options,
  source,
  onScene,
  onOther,
}: {
  options: Category[];
  source: TopicSource;
  onScene: (id: SceneId) => void;
  onOther: () => void;
}) {
  const r = useReveal();
  const general = options.length === 1 && options[0] === "general";
  const scenes = general ? CATEGORY_SCENES.general : [...new Set(options.map((c) => CATEGORY_SCENES[c][0]!))];
  return (
    <StagePanel label="З чого почнемо" className="gap-6">
      {!general && (
        <motion.p {...r.rise(0)} className="text-lede max-w-2xl text-balance text-frost/90">
          {confirmPhrase(options, options[0] ?? null)}
        </motion.p>
      )}
      <motion.div {...r.word(0.15, 1)}>
        <StageHeading size="title">З чого почнемо?</StageHeading>
      </motion.div>
      <motion.ul variants={listStagger} initial="hidden" animate="show" className="grid w-full max-w-2xl gap-3 sm:grid-cols-2" aria-label="Дії">
        {scenes.map((id) => (
          <SceneCard key={id} id={id} onChoose={onScene} />
        ))}
      </motion.ul>
      <div className="flex flex-col items-center gap-1">
        {SOURCE_NOTE[source] && <p className="text-xs text-mist">{SOURCE_NOTE[source]}</p>}
        <Button variant="quiet" onClick={onOther}>
          Змінити тему
        </Button>
      </div>
    </StagePanel>
  );
}

/** Одне уточнення, коли модель не впевнена. */
export function Clarify({ categories, onCategory, onOther }: { categories: Category[]; onCategory: (c: Category) => void; onOther: () => void }) {
  const r = useReveal();
  return (
    <StagePanel label="Уточнення" className="gap-7">
      <motion.div {...r.word(0, 1)}>
        <StageHeading size="title">Про що це більше?</StageHeading>
      </motion.div>
      <motion.ul variants={listStagger} initial="hidden" animate="show" className="flex max-w-2xl flex-wrap justify-center gap-2">
        {categories.map((c) => (
          <motion.li key={c} variants={item} className="list-none">
            <button type="button" onClick={() => onCategory(c)} className="flex min-h-11 items-center rounded-[var(--radius-hair)] border border-mist/40 bg-abyss/50 px-4 py-2 text-sm text-frost hover:border-frost">
              {CATEGORY_COPY[c].label}
            </button>
          </motion.li>
        ))}
        <motion.li variants={item} className="list-none">
          <button type="button" onClick={onOther} className="flex min-h-11 items-center rounded-[var(--radius-hair)] border border-mist/40 bg-abyss/50 px-4 py-2 text-sm text-frost hover:border-frost">
            Щось інше
          </button>
        </motion.li>
      </motion.ul>
    </StagePanel>
  );
}

const REASON_COPY: Partial<Record<ClientReason, string>> = {
  not_configured: "Автоматичне визначення теми зараз вимкнене.",
  offline: "Схоже, немає інтернету. Сцени працюють і без нього.",
  rate_limited: "Забагато запитів за короткий час. Обери сцену — так навіть швидше.",
  quota: "Ліміт автоматичних визначень на сьогодні вичерпано.",
  budget: "Ліміт автоматичних визначень на сьогодні вичерпано.",
  timeout: "Автоматичне визначення не встигло відповісти.",
};

/** Ручний вибір сцени (і «Змінити сцену»). Підказки за словами в тексті — підписані як такі. */
export function Manual({
  reason,
  suggestions,
  onScene,
  onSupport,
}: {
  reason: ClientReason | null;
  suggestions: Category[];
  onScene: (id: SceneId) => void;
  onSupport: () => void;
}) {
  const r = useReveal();
  const note = reason ? (REASON_COPY[reason] ?? "Тему не вдалося визначити автоматично.") : null;
  const hinted = new Set(suggestions);
  const ids = [...SCENE_IDS].sort((a, b) => Number(hinted.has(SCENE_CATEGORY[b])) - Number(hinted.has(SCENE_CATEGORY[a])));
  return (
    <StagePanel label="Вибір сцени" className="gap-6">
      <motion.div {...r.word(0, 1)} className="flex flex-col items-center gap-3">
        <StageHeading size="title">Що зараз найближче?</StageHeading>
        {note && <p className="text-sm text-mist">{note}</p>}
      </motion.div>
      <motion.ul variants={listStagger} initial="hidden" animate="show" className="grid w-full max-w-2xl gap-3 sm:grid-cols-2" aria-label="Сцени">
        {ids.map((id) => (
          <SceneCard key={id} id={id} onChoose={onScene} note={hinted.has(SCENE_CATEGORY[id]) ? "за словами в тексті" : undefined} />
        ))}
      </motion.ul>
      <Button variant="quiet" onClick={onSupport}>
        Мені зараз дуже важко
      </Button>
    </StagePanel>
  );
}

/** Війна: злість — карта; страх чи втрата — тихіша дія спершу. */
export function WarChoice({ mood, onScene }: { mood: WarMood; onScene: (id: SceneId) => void }) {
  const r = useReveal();
  const quietFirst = mood === "fear" || mood === "grief";
  const quiet = mood === "grief" ? (["unsaid", "sand"] as const) : WAR_QUIET_SCENES;
  return (
    <StagePanel label="Що зараз потрібно" className="gap-6">
      <motion.div {...r.word(0, 1)}>
        <StageHeading size="title">{quietFirst ? "Можна тихіше" : "Що зараз потрібно?"}</StageHeading>
      </motion.div>
      <motion.p {...r.rise(0.2)} className="max-w-xl text-balance text-frost/80">
        {mood === "grief"
          ? "Схоже, це про втрату. Тут можна сказати недоговорене або просто побути з тишею."
          : mood === "fear"
            ? "Схоже, це більше про страх. Можна спершу зробити щось спокійне руками."
            : "Якщо війна зараз більше про страх чи втрату, тихіша дія може бути доречнішою."}
      </motion.p>
      <motion.ul variants={listStagger} initial="hidden" animate="show" className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
        {quietFirst ? (
          <>
            {quiet.map((id) => (
              <SceneCard key={id} id={id} onChoose={onScene} />
            ))}
            <SceneCard id="war_map" onChoose={onScene} note="якщо це все ж злість" />
          </>
        ) : (
          <>
            <SceneCard id="war_map" onChoose={onScene} />
            {quiet.map((id) => (
              <SceneCard key={id} id={id} onChoose={onScene} />
            ))}
          </>
        )}
      </motion.ul>
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
      <motion.div {...r.rise(0.9)} className={cn("flex flex-wrap items-center justify-center gap-3")}>
        <Button size="lg" variant="ghost" onClick={onOther}>
          Інша сцена
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
