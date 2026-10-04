"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StagePanel } from "@/components/flow/StagePanel";
import { MAX_TEXT_LENGTH, MIN_TEXT_LENGTH } from "@/lib/ai/schema";

/** «Видихай» проявляється один раз за відкриття сторінки (повернення зі сцени — без повтору). */
let exhaled = false;

const WORD = "Видихай.";

/**
 * Перший екран і екран письма: великий заголовок, коротке питання, поле й прості кнопки.
 * Текст, кнопки й поле видно одразу (CSS, без очікування відео чи JS-анімацій).
 */
export function Compose({
  value,
  onChange,
  onSubmit,
  onLocal,
  onDictate,
  onManual,
  first,
}: {
  value: string;
  onChange: (text: string) => void;
  /** Підібрати сцену через ШІ (передача тексту — лише після цієї дії). */
  onSubmit: () => void;
  /** Підбір за словами в тексті просто на пристрої. */
  onLocal: () => void;
  onDictate: () => void;
  onManual: () => void;
  /** Перший екран (з коротким вступом). */
  first: boolean;
}) {
  const id = useId();
  const [quiet] = useState(() => exhaled);
  const [howOpen, setHowOpen] = useState(false);
  useEffect(() => {
    exhaled = true;
  }, []);
  const length = value.trim().length;
  const canSubmit = length >= MIN_TEXT_LENGTH && length <= MAX_TEXT_LENGTH;
  const exit = { opacity: 0, filter: "blur(10px)", transition: { duration: 0.5 } };

  return (
    <StagePanel label="Видихни" focusOnMount={false} visibleOnLoad className="gap-5 sm:gap-7">
      <motion.div initial={false} exit={exit}>
        <h1 data-stage-heading tabIndex={-1} className={`exhale text-mega font-display font-medium italic text-frost outline-none ${quiet ? "exhale-done" : ""}`}>
          <span className="sr-only">{WORD}</span>
          <span aria-hidden className="exhale-word">
            {[...WORD].map((ch, i) => (
              <span key={i} className="exhale-letter" style={{ "--i": i } as React.CSSProperties}>
                {ch}
              </span>
            ))}
          </span>
        </h1>
      </motion.div>

      <motion.div initial={false} exit={exit} className="animate-rise-in flex max-w-xl flex-col items-center gap-1">
        <p className="text-lede text-balance text-frost/90">Що зараз не дає тобі спокою?</p>
        <p className="text-sm tracking-[0.02em] text-mist">Напиши як є. Матюкатись можна.</p>
      </motion.div>

      <motion.form
        initial={false}
        exit={{ opacity: 0, transition: { duration: 0.3 } }}
        className="animate-rise-in flex w-full max-w-2xl flex-col gap-3 text-left"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit();
        }}
      >
        <label htmlFor={id} className="sr-only">
          Що накипіло
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
            rows={first ? 3 : 5}
            autoFocus={!first}
            spellCheck
            lang="uk"
            placeholder="Що накипіло?"
            aria-describedby={`${id}-note`}
            className="field-sizing-content block max-h-[38dvh] min-h-24 w-full resize-none bg-transparent px-4 py-3 text-[1.0625rem] leading-relaxed text-frost placeholder:text-mist/60 sm:px-5 sm:text-lg"
          />
          {length > MAX_TEXT_LENGTH * 0.8 && (
            <div aria-live="polite" className="border-t border-steel/30 px-4 py-1.5 text-right text-xs tabular-nums text-mist/80">
              {length} / {MAX_TEXT_LENGTH}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p id={`${id}-note`} className="text-xs leading-relaxed text-frost/70">
            Для підбору сцени текст буде передано сервісу ШІ.{" "}
            <button type="button" aria-expanded={howOpen} aria-controls={`${id}-how`} onClick={() => setHowOpen((o) => !o)} className="min-h-8 underline underline-offset-4 hover:text-frost">
              Як використовується твій текст
            </button>
          </p>
          <Button type="submit" size="lg" disabled={!canSubmit} className="min-w-44 max-sm:w-full">
            Підібрати сцену
          </Button>
        </div>

        {howOpen && (
          <div id={`${id}-how`} className="flex flex-col gap-1.5 rounded-[var(--radius-hair)] border border-steel/40 bg-abyss/70 px-4 py-3 text-sm leading-relaxed text-frost/85">
            <p>
              <b className="font-semibold text-frost">Що передається:</b> лише текст із цього поля — після натискання «Підібрати сцену». Під час набору нічого не
              надсилається.
            </p>
            <p>
              <b className="font-semibold text-frost">Кому й навіщо:</b> нашому серверу, а він — сервісу Cloudflare Workers AI, щоб підібрати сцену. Більше ні для чого.
            </p>
            <p>
              <b className="font-semibold text-frost">Зберігання:</b> ми не записуємо текст ні в базу, ні в журнали, ні в аналітику. Як обробляє запити сам Cloudflare, визначає
              його політика конфіденційності.
            </p>
            <p>
              <b className="font-semibold text-frost">Без передачі:</b> «Без ШІ» підбере сцену за словами просто на пристрої, а «Обрати самому» — взагалі без тексту.{" "}
              <Link href="/privacy" className="underline underline-offset-4 hover:text-frost">
                Докладніше
              </Link>
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 sm:justify-start">
          <Button variant="quiet" onClick={onLocal} disabled={!canSubmit}>
            Без ШІ
          </Button>
          <Button variant="quiet" onClick={onManual}>
            Обрати самому
          </Button>
          <Button variant="quiet" onClick={onDictate}>
            <MicIcon className="size-4 shrink-0" />
            Сказати голосом
          </Button>
        </div>
      </motion.form>

      {first && (
        <motion.div initial={false} exit={{ opacity: 0, transition: { duration: 0.3 } }} className="animate-rise-in flex max-w-xl flex-col gap-2 text-sm leading-relaxed text-frost/75">
          <p className="text-balance">Іноді хочеться хоча б на хвилину відкласти все, що тисне. Тут можна надати цьому форму — і щось із нею зробити.</p>
          <p className="text-balance max-sm:hidden">
            Уяви свою проблему. Вивантаж її каменями з рюкзака, розплутай думки або розбий тарілку з тим, що бісить. А якщо немає сил — просто запали свічку й побудь тут.
          </p>
          <details className="group mx-auto text-left">
            <summary className="min-h-10 cursor-pointer list-none text-center text-frost/85 underline-offset-4 hover:underline">Як це працює</summary>
            <p className="mt-1 max-w-md text-balance sm:hidden">
              Уяви свою проблему. Вивантаж її каменями з рюкзака, розплутай думки або розбий тарілку з тим, що бісить. А якщо немає сил — просто запали свічку й побудь тут.
            </p>
            <p className="mt-2 max-w-md text-balance">
              Це простір для візуалізації: ти бачиш і відчуваєш дію, яку обираєш самостійно. Проблема може залишитися, але, можливо, стане трохи легше — і зʼявиться
              місце для наступного кроку в житті.
            </p>
          </details>
        </motion.div>
      )}
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
