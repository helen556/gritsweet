import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getOrder, STATUS_LABELS, STATUS_FLOW } from "@/lib/orders";
import { formatUaPhone } from "@/lib/phone";
import { formatUah } from "@/lib/pricing";
import { ActionForm } from "@/components/admin/ActionForm";
import { rescheduleOrder, saveOrderDetails, updateOrderStatus } from "../../actions";
import type { OrderStatus } from "@/db/types";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const data = await getOrder(id);
  if (!data) notFound();
  const { order: o, snapshot: s, events } = data;
  const idx = STATUS_FLOW.indexOf(o.status);
  const nextStatus: OrderStatus | null = idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
  const dangerous = (st: OrderStatus) => st === "REJECTED" || st === "CANCELLED";

  return (
    <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
      <div className="grid gap-5">
        <div>
          <Link href="/admin/orders" className="text-sm underline">← Усі заявки</Link>
          <h1 className="mt-2 text-3xl">{o.customer_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a href={`tel:${o.phone}`} className="btn btn-cherry !min-h-11">Подзвонити {formatUaPhone(o.phone)}</a>
            <span className="rounded-full bg-cream px-3 py-1 text-sm font-semibold">{STATUS_LABELS[o.status]}</span>
          </div>
        </div>
        <section className="card p-5">
          <h2 className="text-2xl">Склад заявки</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">Позиція</dt><dd className="font-medium">{s.categoryName}: {s.productName}{s.sizeLabel ? ` (${s.sizeLabel})` : ""}</dd></div>
            <div><dt className="text-muted">Кількість / вага</dt><dd>{s.qtyLabel}</dd></div>
            {s.filling && <div><dt className="text-muted">Начинка</dt><dd>{s.filling}</dd></div>}
            {s.selections?.map((x) => <div key={x.label}><dt className="text-muted">{x.label}</dt><dd>{x.value}</dd></div>)}
            <div><dt className="text-muted">Бажана дата</dt><dd>{o.desired_date}</dd></div>
            <div><dt className="text-muted">Отримання</dt><dd>{s.deliveryLabel}</dd></div>
            <div><dt className="text-muted">Орієнтовна ціна на момент подання</dt><dd className="font-medium">{s.estimateLabel}</dd></div>
            <div><dt className="text-muted">Подано</dt><dd>{o.created_at.replace("T", " ").slice(0, 16)}</dd></div>
          </dl>
          {o.wishes && <div className="mt-4"><h3 className="text-sm text-muted">Побажання</h3><p className="whitespace-pre-wrap">{o.wishes}</p></div>}
          {o.reference_path && <div className="mt-4"><h3 className="text-sm text-muted">Референс</h3><a href={`/admin/reference/${o.reference_path}`} target="_blank" rel="noopener"><img src={`/admin/reference/${o.reference_path}`} alt="Референс клієнта" className="mt-1 max-h-72 rounded-xl" /></a></div>}
        </section>
        <section className="card p-5">
          <h2 className="text-2xl">Остаточна ціна та нотатки</h2>
          <ActionForm action={saveOrderDetails} hiddens={{ id: o.id }} submitLabel="Зберегти">
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label>Остаточна узгоджена ціна, грн<input name="finalPrice" inputMode="decimal" defaultValue={o.final_price != null ? o.final_price / 100 : ""} className="field mt-1" placeholder="порожньо = ще не узгоджено" /></label>
              <div className="text-sm text-muted sm:pt-7">{o.final_price != null ? `Узгоджено: ${formatUah(o.final_price)}` : "Ще не узгоджено"}</div>
            </div>
            <label className="mt-3 block">Приватні нотатки (клієнт не бачить)<textarea name="adminNotes" defaultValue={o.admin_notes} className="field mt-1 min-h-28" /></label>
          </ActionForm>
        </section>
      </div>
      <div className="grid gap-5 content-start">
        <section className="card p-5">
          <h2 className="text-2xl">Статус</h2>
          <p className="mt-1 text-xs text-muted">Зміна статусу не надсилає повідомлення клієнту — зв’яжіться з ним самостійно.</p>
          <div className="mt-3 grid gap-2">
            {nextStatus && <ActionForm action={updateOrderStatus} hiddens={{ id: o.id, status: nextStatus }} submitLabel={`→ ${STATUS_LABELS[nextStatus]}`} submitClass="btn btn-cherry w-full" inline className="w-full" />}
            {STATUS_FLOW.filter((st) => st !== o.status && st !== nextStatus).map((st) => (
              <ActionForm key={st} action={updateOrderStatus} hiddens={{ id: o.id, status: st }} submitLabel={STATUS_LABELS[st]} submitClass="btn btn-outline w-full !min-h-11" inline className="w-full" />
            ))}
            {(["REJECTED", "CANCELLED"] as OrderStatus[]).filter((st) => st !== o.status).map((st) => (
              <ActionForm key={st} action={updateOrderStatus} hiddens={{ id: o.id, status: st }} submitLabel={STATUS_LABELS[st]} submitClass="btn btn-outline w-full !min-h-11 text-cherry" inline className="w-full" confirm={dangerous(st) ? `Позначити заявку як «${STATUS_LABELS[st]}»?` : undefined} />
            ))}
          </div>
        </section>
        <section className="card p-5">
          <h2 className="text-2xl">Перенести дату</h2>
          <ActionForm action={rescheduleOrder} hiddens={{ id: o.id }} submitLabel="Перенести" submitClass="btn btn-outline">
            <input type="date" name="date" defaultValue={o.desired_date} className="field mt-3" required />
          </ActionForm>
        </section>
        <section className="card p-5">
          <h2 className="text-2xl">Історія</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {events.map((e) => { const p = JSON.parse(e.payload); return (
              <li key={e.id} className="border-b border-ink/10 pb-2">
                <span className="text-muted">{e.created_at.replace("T", " ").slice(0, 16)}</span> ·{" "}
                {e.type === "CREATED" && <>Заявку створено{p.urgent ? " (термінова: менше рекомендованого терміну)" : ""}</>}
                {e.type === "STATUS" && <>Статус: {STATUS_LABELS[p.from as OrderStatus]} → {STATUS_LABELS[p.to as OrderStatus]}</>}
                {e.type === "RESCHEDULE" && <>Дату змінено: {p.from} → {p.to}</>}
                {e.type === "FINAL_PRICE" && <>Остаточна ціна: {p.from != null ? formatUah(p.from) : "—"} → {p.to != null ? formatUah(p.to) : "—"}</>}
                {e.type === "NOTES" && <>Нотатки оновлено</>}
              </li>); })}
          </ul>
        </section>
      </div>
    </div>
  );
}
