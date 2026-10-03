"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { StageHeading, StagePanel } from "@/components/flow/StagePanel";
import { UA_HELP_CONTACTS } from "@/lib/safety/resources";
import { track } from "@/lib/analytics/track";

/**
 * Нейтральний режим безпеки. Без ігор, без руйнування, без анімацій, крім звичайного проявлення.
 * Не ставить діагнозів і не «лікує» — лише короткі кроки до живих людей.
 */
export function SafetyFlow({ onBack }: { onBack: () => void }) {
  useEffect(() => {
    track("safety_shown");
  }, []);

  return (
    <StagePanel label="Підтримка" className="max-w-2xl gap-8">
      <StageHeading size="title">Зараз важливо не лишатися з цим наодинці.</StageHeading>

      <div className="flex w-full flex-col gap-6 text-left">
        <ol className="space-y-3 text-lede text-frost/90">
          <li>Напиши або подзвони людині, якій довіряєш. Прямо зараз — можна просто «мені погано».</li>
          <li>Якщо є небезпека для життя — дзвони в екстрену службу.</li>
          <li>Можна поговорити з кризовою лінією. Там вислухають.</li>
        </ol>

        <ul className="divide-y divide-steel/40 rounded-[var(--radius-hair)] border border-steel/50 bg-abyss/70" aria-label="Куди звернутися">
          {UA_HELP_CONTACTS.map((c) => (
            <li key={c.dial}>
              <a
                href={`tel:${c.dial}`}
                className="flex min-h-16 items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-night/80"
              >
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

      <Button variant="quiet" onClick={onBack}>
        Повернутися до тексту
      </Button>
    </StagePanel>
  );
}
