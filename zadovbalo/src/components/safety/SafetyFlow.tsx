"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { StageHeading, StagePanel } from "@/components/flow/StagePanel";
import { UA_HELP_CONTACTS } from "@/lib/safety/resources";
import { track } from "@/lib/analytics/track";

/**
 * Спокійний екран підтримки. Без ігор і руйнування. Не діагноз і не оцінка ризику —
 * лише шлях до живих людей і можливість обрати тиху дію або вийти.
 */
export function SafetyFlow({ onQuiet, onTopics, onExit }: { onQuiet: () => void; onTopics: () => void; onExit: () => void }) {
  useEffect(() => {
    track("support_shown");
  }, []);

  return (
    <StagePanel label="Підтримка" className="max-w-2xl gap-7">
      <StageHeading size="title">Зараз важливо не лишатися з цим наодинці.</StageHeading>

      <div className="flex w-full flex-col gap-5 text-left">
        <ul className="space-y-2 text-lede text-frost/90">
          <li>Напиши або подзвони людині, якій довіряєш. Можна просто: «мені зараз погано».</li>
          <li>Якщо є небезпека для життя — дзвони в екстрену службу.</li>
          <li>Можна поговорити з кризовою лінією. Там вислухають.</li>
        </ul>

        <ul className="divide-y divide-steel/40 rounded-[var(--radius-hair)] border border-steel/50 bg-abyss/75" aria-label="Куди звернутися в Україні">
          {UA_HELP_CONTACTS.map((c) => (
            <li key={c.dial}>
              <a href={`tel:${c.dial}`} className="flex min-h-16 items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-night/80">
                <span className="flex flex-col">
                  <span className="font-medium text-frost">{c.label}</span>
                  <span className="text-sm text-mist">{c.note}</span>
                </span>
                <span className="whitespace-nowrap font-sans text-xl font-semibold tabular-nums tracking-wide text-frost">{c.phone}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="text-sm text-mist">Не в Україні? Набери місцевий номер екстреної допомоги.</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="ghost" size="lg" onClick={onQuiet}>
          Тиха дія: запалити свічку
        </Button>
        <Button variant="quiet" onClick={onTopics}>
          Це не про те — обрати сцену
        </Button>
        <Button variant="quiet" onClick={onExit}>
          Вийти
        </Button>
      </div>
    </StagePanel>
  );
}
