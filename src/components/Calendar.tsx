"use client";
import { useEffect, useMemo, useState } from "react";

const MONTHS = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];
const DOW = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export type CalendarInfo = { today: string; closed: string[]; leadDays: number };

/** Публічний календар: минулі й закриті дати недоступні. Керування з клавіатури через кнопки. */
export function Calendar({ value, onChange, onInfo }: { value: string; onChange: (d: string) => void; onInfo?: (i: CalendarInfo) => void }) {
  const [info, setInfo] = useState<CalendarInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<{ y: number; m: number } | null>(null);

  useEffect(() => {
    const now = new Date();
    const from = iso(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 4, 0);
    const to = iso(end.getFullYear(), end.getMonth(), end.getDate());
    fetch(`/api/availability?from=${from}&to=${to}`).then((r) => r.json()).then((d: CalendarInfo) => {
      setInfo(d); onInfo?.(d);
      const [y, m] = d.today.split("-").map(Number);
      setView({ y, m: m - 1 });
    }).catch(() => setError("Не вдалося завантажити календар. Перевірте з’єднання."));
  }, [onInfo]);

  const days = useMemo(() => {
    if (!view) return [];
    const first = new Date(view.y, view.m, 1);
    const offset = (first.getDay() + 6) % 7;
    const count = new Date(view.y, view.m + 1, 0).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)] as (number | null)[];
  }, [view]);

  if (error) return <p className="error">{error}</p>;
  if (!info || !view) return <p className="text-sm text-muted">Завантаження календаря…</p>;
  const closed = new Set(info.closed);
  const [ty, tm] = info.today.split("-").map(Number);
  const canPrev = view.y > ty || (view.y === ty && view.m > tm - 1);
  const canNext = (view.y - ty) * 12 + (view.m - (tm - 1)) < 3;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-cream)]">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" className="chip !min-h-10" disabled={!canPrev} onClick={() => setView((v) => v && (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))} aria-label="Попередній місяць">‹</button>
        <span className="font-semibold">{MONTHS[view.m]} {view.y}</span>
        <button type="button" className="chip !min-h-10" disabled={!canNext} onClick={() => setView((v) => v && (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))} aria-label="Наступний місяць">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">{DOW.map((d) => <span key={d} className="py-1">{d}</span>)}</div>
      <div className="grid grid-cols-7 gap-1" role="group" aria-label="Оберіть бажану дату">
        {days.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const date = iso(view.y, view.m, d);
          const past = date < info.today;
          const isClosed = closed.has(date);
          const disabled = past || isClosed;
          const selected = value === date;
          return (
            <button key={date} type="button" disabled={disabled} aria-pressed={selected} aria-label={`${d} ${MONTHS[view.m]}${isClosed ? ", недоступно" : ""}`} onClick={() => onChange(date)}
              className={`aspect-square rounded-xl text-sm font-medium transition-colors ${selected ? "bg-cherry text-white" : disabled ? "text-ink/25 line-through" : "hover:bg-milk"}`}>{d}</button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted">Перекреслені дати недоступні. Обрана дата — побажання, не гарантія прийняття замовлення.</p>
    </div>
  );
}
