import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { todayKyiv } from "@/lib/dates";
import { STATUS_LABELS, withSnap } from "@/lib/orders";
import { ActionForm } from "@/components/admin/ActionForm";
import { saveDay, setDays } from "../actions";

const MONTHS = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];
const pad = (n: number) => String(n).padStart(2, "0");

export default async function CalendarAdmin({ searchParams }: { searchParams: Promise<{ m?: string; day?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = todayKyiv();
  const [ty, tm] = today.split("-").map(Number);
  const [y, m] = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m!.split("-").map(Number) : [ty, tm];
  const first = `${y}-${pad(m)}-01`; const last = `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
  const days = await db.selectFrom("calendar_days").selectAll().where("date", ">=", first).where("date", "<=", last).execute();
  const dayMap = new Map(days.map((d) => [d.date, d]));
  const orders = (await db.selectFrom("orders").selectAll().where("desired_date", ">=", first).where("desired_date", "<=", last).where("status", "not in", ["REJECTED", "CANCELLED", "DONE"]).execute()).map(withSnap);
  const byDate = (d: string) => orders.filter((o) => o.desired_date === d);
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const count = new Date(y, m, 0).getDate();
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`; const next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  const selected = sp.day && sp.day.startsWith(`${y}-${pad(m)}`) ? sp.day : null;
  const selDay = selected ? dayMap.get(selected) : undefined;
  const upcoming = (await db.selectFrom("orders").selectAll().where("desired_date", ">=", today).where("status", "in", ["CONFIRMED", "IN_PROGRESS"]).orderBy("desired_date").limit(15).execute()).map(withSnap);

  return (
    <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl">Календар</h1>
          <div className="flex gap-2"><Link href={`?m=${prev}`} className="chip">‹</Link><span className="chip !cursor-default">{MONTHS[m - 1]} {y}</span><Link href={`?m=${next}`} className="chip">›</Link></div>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-muted">{["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((d) => <span key={d}>{d}</span>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: offset }).map((_, i) => <span key={`e${i}`} />)}
          {Array.from({ length: count }, (_, i) => i + 1).map((d) => {
            const date = `${y}-${pad(m)}-${pad(d)}`;
            const info = dayMap.get(date); const os = byDate(date);
            const confirmed = os.filter((o) => ["CONFIRMED", "IN_PROGRESS"].includes(o.status)).length;
            const fresh = os.length - confirmed;
            return (
              <Link key={date} href={`?m=${y}-${pad(m)}&day=${date}`} aria-current={selected === date ? "date" : undefined}
                className={`flex aspect-square flex-col rounded-xl p-1 text-xs ${info?.is_closed ? "bg-ink/10 text-ink/50" : "bg-white"} ${selected === date ? "ring-2 ring-cherry" : ""} ${date < today ? "opacity-60" : ""}`}>
                <span className={`font-semibold ${date === today ? "text-cherry" : ""}`}>{d}</span>
                <span className="mt-auto flex flex-wrap gap-0.5">
                  {confirmed > 0 && <span className="rounded bg-choco px-1 text-[10px] text-cream" title="підтверджені">{confirmed}</span>}
                  {fresh > 0 && <span className="rounded bg-cherry/15 px-1 text-[10px] text-cherry" title="нові / уточнення">{fresh}</span>}
                  {info?.note && <span aria-label="є примітка">·</span>}
                </span>
              </Link>);
          })}
        </div>
        <p className="mt-2 text-xs text-muted">Сірі — закриті дні. Темний бейдж — підтверджені, вишневий — нові/уточнення (не займають день).</p>

        <section className="card mt-5 p-5">
          <h2 className="text-2xl">Закрити або відкрити дні</h2>
          <ActionForm action={setDays} submitLabel="Застосувати" confirm="Змінити доступність цих дат? Підтверджені замовлення на них не скасовуються.">
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label>Від<input type="date" name="from" required className="field mt-1" defaultValue={selected ?? today} /></label>
              <label>До (необов’язково)<input type="date" name="to" className="field mt-1" /></label>
              <label>Дія<select name="mode" className="field mt-1"><option value="close">Закрити (вихідні)</option><option value="open">Відкрити</option></select></label>
            </div>
          </ActionForm>
        </section>
      </div>

      <div className="grid gap-5 content-start">
        {selected && (
          <section className="card p-5">
            <h2 className="text-2xl">{selected}</h2>
            <p className="text-sm text-muted">{selDay?.is_closed ? "День закритий" : "День відкритий"}</p>
            <ActionForm action={saveDay} hiddens={{ date: selected }} submitLabel="Зберегти">
              <label className="mt-3 block">Ліміт підтверджених на день<input name="limit" inputMode="numeric" defaultValue={selDay?.day_limit ?? ""} className="field mt-1" placeholder="порожньо = без ліміту" /></label>
              <label className="mt-3 block">Приватна примітка<textarea name="note" defaultValue={selDay?.note ?? ""} className="field mt-1 min-h-20" /></label>
            </ActionForm>
            <h3 className="mt-4 text-lg">Заявки на цей день</h3>
            {byDate(selected).length === 0 ? <p className="text-sm text-muted">Немає</p> : (
              <ul className="mt-2 grid gap-2 text-sm">{byDate(selected).map((o) => <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="underline">{o.customer_name}</Link> · {o.snap.productName}, {o.snap.qtyLabel} · <span className="text-muted">{STATUS_LABELS[o.status]}</span></li>)}</ul>)}
          </section>
        )}
        <section className="card p-5">
          <h2 className="text-2xl">Найближчі підтверджені</h2>
          {upcoming.length === 0 ? <p className="mt-2 text-sm text-muted">Немає</p> : (
            <ul className="mt-2 grid gap-2 text-sm">{upcoming.map((o) => <li key={o.id}><span className="font-semibold">{o.desired_date}</span> · <Link href={`/admin/orders/${o.id}`} className="underline">{o.customer_name}</Link> · {o.snap.productName}, {o.snap.qtyLabel}</li>)}</ul>)}
        </section>
      </div>
    </div>
  );
}
