"use client";

import { motion } from "motion/react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useReveal } from "@/components/ui/motion";
import { formatAmount } from "@/lib/scenes/debt";
import { parseAmountInput } from "@/lib/text";
import { CURRENCIES, type Currency } from "@/lib/topics";
import { StageHeading, StagePanel } from "./StagePanel";

const CURRENCY_LABEL: Record<Currency, string> = { UAH: "₴ гривні", USD: "$ долари", EUR: "€ євро", PLN: "zł злоті", GBP: "£ фунти" };

const field =
  "min-h-12 w-full rounded-[var(--radius-hair)] border border-steel/55 bg-abyss/70 px-4 text-lg text-frost focus-visible:border-frost/80 focus-visible:outline-none";

/** Сума й валюта для вправи. Нічого не вигадуємо: знайдене в тексті лише пропонуємо підтвердити. */
export function DebtSetup({
  amount,
  currency,
  onDone,
  onBack,
}: {
  amount: number | null;
  currency: Currency | null;
  onDone: (amount: number, currency: Currency | null) => void;
  onBack: () => void;
}) {
  const r = useReveal();
  const id = useId();
  const [raw, setRaw] = useState(amount ? String(amount).replace(".", ",") : "");
  const [cur, setCur] = useState<Currency | "">(currency ?? "");
  const value = parseAmountInput(raw);
  const invalid = raw.trim() !== "" && value === null;
  return (
    <StagePanel label="Налаштування суми" className="gap-6" focusOnMount={false}>
      <motion.div {...r.word(0, 1)}>
        <StageHeading size="title">Яка сума тисне?</StageHeading>
      </motion.div>
      {amount ? (
        <p className="text-frost/80">У тексті є сума {formatAmount(amount, currency, amount)}. Підтверди або зміни.</p>
      ) : (
        <p className="text-frost/80">Можна приблизно. Вона потрібна лише для вправи.</p>
      )}
      <form
        className="flex w-full max-w-md flex-col gap-4 text-left"
        onSubmit={(e) => {
          e.preventDefault();
          if (value) onDone(value, cur || null);
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-a`} className="text-sm text-frost/80">
            Сума
          </label>
          <input id={`${id}-a`} inputMode="decimal" autoComplete="off" autoFocus value={raw} onChange={(e) => setRaw(e.target.value)} aria-invalid={invalid} aria-describedby={`${id}-e`} className={field} placeholder="Наприклад, 48 500" />
          <span id={`${id}-e`} className="min-h-5 text-sm text-ember">
            {invalid ? "Лише число більше нуля, до двох знаків після коми." : ""}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-c`} className="text-sm text-frost/80">
            Валюта
          </label>
          <select id={`${id}-c`} value={cur} onChange={(e) => setCur(e.target.value as Currency | "")} className={field}>
            <option value="">Без валюти</option>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-mist">Суму ніде не зберігаємо й нікуди не надсилаємо.</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="quiet" onClick={onBack}>
            Змінити тему
          </Button>
          <Button type="submit" size="lg" disabled={!value}>
            Далі
          </Button>
        </div>
      </form>
    </StagePanel>
  );
}

/** Короткі підписи каменів. Можна змінити, додати свої чи лишити без назв. */
export function LabelsSetup({
  title,
  intro,
  initial,
  examples,
  onDone,
  onBack,
}: {
  title: string;
  intro: string;
  initial: string[];
  /** Приклади, які людина обирає сама (нічого не додається без її вибору). */
  examples?: string[];
  onDone: (labels: string[]) => void;
  onBack: () => void;
}) {
  const r = useReveal();
  const id = useId();
  const [items, setItems] = useState<string[]>(initial.length ? initial : [""]);
  const clean = items.map((s) => s.trim()).filter(Boolean);
  const set = (i: number, v: string) => setItems((all) => all.map((x, j) => (j === i ? v : x)));
  return (
    <StagePanel label={title} className="gap-6" focusOnMount={false}>
      <motion.div {...r.word(0, 1)}>
        <StageHeading size="title">{title}</StageHeading>
      </motion.div>
      <p className="max-w-xl text-balance text-frost/80">{intro}</p>
      <div className="flex w-full max-w-md flex-col gap-2 text-left">
        {items.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <label htmlFor={`${id}-${i}`} className="sr-only">
              Пункт {i + 1}
            </label>
            <input id={`${id}-${i}`} value={v} maxLength={32} onChange={(e) => set(i, e.target.value)} className={field} />
            <button type="button" onClick={() => setItems((all) => all.filter((_, j) => j !== i))} aria-label={`Прибрати пункт ${i + 1}`} className="scene-btn w-11 shrink-0 justify-center px-0">
              ✕
            </button>
          </div>
        ))}
        {items.length < 8 && (
          <Button variant="quiet" onClick={() => setItems((all) => [...all, ""])} className="self-start">
            + Додати
          </Button>
        )}
        {examples && (
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-sm text-mist">Або обери з прикладів:</p>
            <div className="flex flex-wrap gap-2">
              {examples.map((ex) => {
                const on = clean.includes(ex);
                return (
                  <button
                    key={ex}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setItems((all) => (on ? all.filter((x) => x.trim() !== ex) : [...all.filter((x) => x.trim()), ex].slice(0, 8)))}
                    className={`min-h-11 rounded-[var(--radius-hair)] border px-3 text-sm ${on ? "border-frost bg-frost text-abyss" : "border-steel/50 text-frost/85"}`}
                  >
                    {ex}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="flex w-full max-w-md flex-wrap items-center justify-between gap-3">
        <Button variant="quiet" onClick={onBack}>
          Змінити тему
        </Button>
        <Button size="lg" onClick={() => onDone(clean.slice(0, 8))}>
          {clean.length ? "Далі" : "Без назв"}
        </Button>
      </div>
    </StagePanel>
  );
}
