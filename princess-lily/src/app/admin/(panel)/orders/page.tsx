import Link from "next/link";
import { listOrders, parseFilters, filtersToQuery, kyiv, PAYMENT_LABEL, SHIPPING_LABEL, ORDER_LABEL, METHOD_LABEL, KIND_LABEL, type CrmFilters } from "@/lib/crm";
import { formatMinor } from "@/lib/money";

export const metadata = { title: "Замовлення" };

const KIND_STYLE = { pdf: "bg-moss-100 text-moss-900", print: "bg-rose-100 text-[#7a3b33]", mixed: "bg-gold/40 text-[#5b4416]" } as const;
const PAY_STYLE: Record<string, string> = { paid: "bg-moss-100", pending_verification: "bg-gold/40", failed: "bg-rose-100", cancelled: "bg-black/5" };

function SortLink({ f, col, label }: { f: CrmFilters; col: NonNullable<CrmFilters["sort"]>; label: string }) {
  const active = f.sort === col;
  const dir = active && f.dir === "desc" ? "asc" : "desc";
  return (
    <Link href={`/admin/orders?${filtersToQuery(f, { sort: col, dir, page: 1 })}`} className="inline-flex min-h-9 items-center gap-1 underline-offset-4 hover:underline"
      aria-label={`Сортувати: ${label}`}>
      {label}{active ? (f.dir === "desc" ? " ↓" : " ↑") : ""}
    </Link>
  );
}

/** CRM: таблиця замовлень. Час — Europe/Kyiv (у БД — UTC). Усі фільтри працюють на сервері й однаково для експорту. */
export default async function Orders({ searchParams }: PageProps<"/admin/orders">) {
  const f = parseFilters(await searchParams);
  const { rows, total, sum } = await listOrders(f);
  const pages = Math.max(1, Math.ceil(total / (f.pageSize ?? 25)));
  const exportQ = filtersToQuery({ ...f, page: 1 }, { page: undefined, size: undefined });
  const sel = "input !min-h-11";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl text-moss-900">Замовлення</h1>
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-ghost btn-sm" href={`/admin/orders-export?format=xlsx${exportQ ? `&${exportQ}` : ""}`}>⬇ Excel (.xlsx)</a>
          <a className="btn btn-ghost btn-sm" href={`/admin/orders-export?format=pdf${exportQ ? `&${exportQ}` : ""}`}>⬇ PDF</a>
        </div>
      </div>

      <form className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4" role="search" aria-label="Фільтри замовлень">
        <div className="field lg:col-span-2"><label htmlFor="q">Пошук: номер, ім’я, email, телефон</label><input id="q" name="q" defaultValue={f.q} className={sel} /></div>
        <div className="field"><label htmlFor="from">Період від (Київ)</label><input id="from" name="from" type="date" defaultValue={f.from} className={sel} /></div>
        <div className="field"><label htmlFor="to">до</label><input id="to" name="to" type="date" defaultValue={f.to} className={sel} /></div>
        <div className="field"><label htmlFor="payment">Оплата</label><select id="payment" name="payment" defaultValue={f.payment} className={sel}><option value="">Усі</option>{Object.entries(PAYMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="field"><label htmlFor="shipping">Доставка</label><select id="shipping" name="shipping" defaultValue={f.shipping} className={sel}><option value="">Усі</option><option value="none">Без доставки (PDF)</option>{Object.entries(SHIPPING_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="field"><label htmlFor="kind">Формат</label><select id="kind" name="kind" defaultValue={f.kind} className={sel}><option value="">Усі</option><option value="pdf">Лише PDF</option><option value="print">Лише друк</option><option value="mixed">Змішані</option></select></div>
        <div className="field"><label htmlFor="status">Стан замовлення</label><select id="status" name="status" defaultValue={f.status} className={sel}><option value="">Усі</option>{Object.entries(ORDER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <input type="hidden" name="sort" value={f.sort} /><input type="hidden" name="dir" value={f.dir} />
        <div className="flex flex-wrap items-end gap-2 lg:col-span-4">
          <button className="btn btn-primary btn-sm">Застосувати</button>
          <Link href="/admin/orders" className="btn btn-ghost btn-sm">Скинути</Link>
          <p className="ml-auto text-sm text-ink-soft" aria-live="polite">Знайдено: <strong>{total}</strong> · сума {formatMinor(sum, "uk")}</p>
        </div>
      </form>

      {/* Таблиця (desktop) */}
      <div className="hidden overflow-x-auto rounded-2xl border border-black/6 bg-paper lg:block">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <caption className="sr-only">Список замовлень</caption>
          <thead className="bg-moss-100/60 text-ink">
            <tr>
              <th className="p-3">Номер</th>
              <th className="p-3"><SortLink f={f} col="created_at" label="Створено (Київ)" /></th>
              <th className="p-3">Покупець / одержувач</th>
              <th className="p-3">Товари</th>
              <th className="p-3 text-right"><SortLink f={f} col="total_minor" label="Сума" /></th>
              <th className="p-3"><SortLink f={f} col="payment_status" label="Оплата" /></th>
              <th className="p-3">Доставка</th>
              <th className="p-3">Відправлення</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-black/5 align-top hover:bg-moss-100/30">
                <td className="whitespace-nowrap p-3"><Link href={`/admin/orders/${r.id}`} className="font-semibold underline underline-offset-4">{r.number}</Link>
                  <span className={`mt-1 block w-fit rounded-full px-2 py-0.5 text-xs ${KIND_STYLE[r.kind]}`}>{KIND_LABEL[r.kind]}</span></td>
                <td className="whitespace-nowrap p-3">{kyiv(r.created_at)}<span className="block text-xs text-ink-soft">{ORDER_LABEL[r.order_status ?? "new"]}</span></td>
                <td className="p-3">{r.name}{r.recipient && <span className="block text-xs text-ink-soft">Одержувач: {r.recipient}</span>}<span className="block text-xs text-ink-soft">{r.email}{r.phone ? ` · ${r.phone}` : ""}</span></td>
                <td className="max-w-xs p-3">{r.itemsText}</td>
                <td className="whitespace-nowrap p-3 text-right font-semibold">{formatMinor(r.total_minor, "uk")}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 ${PAY_STYLE[r.payment_status] ?? "bg-cream"}`}>{PAYMENT_LABEL[r.payment_status]}</span>
                  <span className="mt-1 block text-xs text-ink-soft">{METHOD_LABEL[r.payment_method ?? r.payment_mode] ?? r.payment_mode}</span></td>
                <td className="p-3">{r.shipping_required ? <>Нова пошта<span className="block text-xs text-ink-soft">{r.np_city}, {r.np_point}</span></> : <span className="text-ink-soft">PDF — без доставки</span>}</td>
                <td className="p-3">{r.shippingStatus ? SHIPPING_LABEL[r.shippingStatus] : "—"}{r.ttn && <span className="block font-mono text-xs">{r.ttn}</span>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="p-6 text-center text-ink-soft">Замовлень не знайдено</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Картки (телефон) */}
      <ul className="space-y-3 lg:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/orders/${r.id}`} className="card block p-4">
              <div className="flex items-center justify-between gap-2"><span className="font-semibold">{r.number}</span><span className={`rounded-full px-2 py-0.5 text-xs ${KIND_STYLE[r.kind]}`}>{KIND_LABEL[r.kind]}</span></div>
              <p className="text-sm text-ink-soft">{kyiv(r.created_at)} · {ORDER_LABEL[r.order_status ?? "new"]}</p>
              <p className="mt-1">{r.name}{r.recipient ? ` → ${r.recipient}` : ""}</p>
              <p className="text-sm text-ink-soft">{r.itemsText}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <strong>{formatMinor(r.total_minor, "uk")}</strong>
                <span className={`rounded-full px-2 py-0.5 ${PAY_STYLE[r.payment_status] ?? "bg-cream"}`}>{PAYMENT_LABEL[r.payment_status]}</span>
                {r.shippingStatus && <span className="rounded-full bg-cream px-2 py-0.5">{SHIPPING_LABEL[r.shippingStatus]}</span>}
              </div>
            </Link>
          </li>
        ))}
        {!rows.length && <li className="text-ink-soft">Замовлень не знайдено</li>}
      </ul>

      <nav aria-label="Сторінки" className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-ink-soft">Сторінка {f.page} з {pages}</span>
        <div className="flex flex-wrap items-center gap-2">
          {f.page! > 1 && <Link className="btn btn-ghost btn-sm" href={`/admin/orders?${filtersToQuery(f, { page: f.page! - 1 })}`}>← Попередня</Link>}
          {f.page! < pages && <Link className="btn btn-ghost btn-sm" href={`/admin/orders?${filtersToQuery(f, { page: f.page! + 1 })}`}>Наступна →</Link>}
          <form className="flex items-center gap-2">
            {Object.entries({ q: f.q, from: f.from, to: f.to, payment: f.payment, shipping: f.shipping, kind: f.kind, status: f.status, sort: f.sort, dir: f.dir }).map(([k, v]) => v ? <input key={k} type="hidden" name={k} value={v} /> : null)}
            <label htmlFor="size" className="text-sm">На сторінці</label>
            <select id="size" name="size" defaultValue={f.pageSize} className="input !min-h-10 !w-20 !py-1"><option>25</option><option>50</option><option>100</option></select>
            <button className="btn btn-ghost btn-sm">OK</button>
          </form>
        </div>
      </nav>
    </div>
  );
}
