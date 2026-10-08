import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { orderDetails } from "@/lib/orders";
import { formatMinor } from "@/lib/money";
import ActionForm from "@/components/admin/ActionForm";
import { confirmPaymentAction, cancelOrderAction, shippingAction, resendPdfAction, makeLinksAction, orderNoteAction } from "../../../actions";

export const metadata = { title: "Замовлення" };
const PS: Record<string, string> = { pending_payment: "Очікує оплату", pending_verification: "Очікує перевірки", paid: "Оплачено", failed: "Неуспішно", cancelled: "Скасовано" };
const FS: Record<string, string> = {
  awaiting_payment: "очікує оплату", ready: "готується лист", sent: "посилання надіслано", email_failed: "лист не надіслано (буде повтор)",
  email_not_configured: "email не налаштовано — створіть посилання вручну", to_ship: "до відправлення", shipped: "відправлено", delivered: "доставлено", cancelled: "скасовано",
};
const kyiv = (iso: string | null) => iso ? new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" }) : "—";

export default async function OrderAdmin({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  const d = await orderDetails(id);
  if (!d) notFound();
  const { order: o, items, digital, shipping } = d;
  const [events, emails] = await Promise.all([
    db.selectFrom("payment_events").selectAll().where("order_id", "=", id).orderBy("created_at", "desc").execute(),
    db.selectFrom("email_deliveries").selectAll().where("order_id", "=", id).orderBy("created_at", "desc").execute(),
  ]);
  const canConfirm = ["pending_payment", "pending_verification", "failed"].includes(o.payment_status);
  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="underline">← Замовлення</Link>
      <section className="card p-5 sm:p-6">
        <h1 className="text-3xl text-moss-900">{o.number}</h1>
        <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-[12rem_1fr]">
          <dt className="text-ink-soft">Створено</dt><dd>{kyiv(o.created_at)}</dd>
          <dt className="text-ink-soft">Покупець</dt><dd>{o.name} · <a className="underline" href={`mailto:${o.email}`}>{o.email}</a>{o.phone && <> · <a className="underline" href={`tel:${o.phone}`}>{o.phone}</a></>}</dd>
          <dt className="text-ink-soft">Мова сайту</dt><dd>{o.site_locale}</dd>
          <dt className="text-ink-soft">Оплата</dt><dd><strong>{PS[o.payment_status]}</strong> · режим: {o.payment_mode}{o.payment_reference && ` · ${o.payment_reference}`}{o.paid_at && ` · ${kyiv(o.paid_at)}`}</dd>
          {digital && (<><dt className="text-ink-soft">Видача PDF</dt><dd>{FS[digital.status] ?? digital.status}</dd></>)}
          {shipping && (<><dt className="text-ink-soft">Доставка</dt><dd>{FS[shipping.status] ?? shipping.status}{shipping.ttn && ` · ТТН ${shipping.ttn}`}<br /><span className="text-ink-soft">{o.np_city}, {o.np_point}</span></dd></>)}
          {o.customer_note && (<><dt className="text-ink-soft">Коментар</dt><dd className="whitespace-pre-wrap">{o.customer_note}</dd></>)}
        </dl>
        <table className="mt-5 w-full text-left text-sm"><thead><tr className="border-b border-black/10"><th className="py-2">Позиція (знімок на момент купівлі)</th><th>К-сть</th><th className="text-right">Сума</th></tr></thead>
          <tbody>{items.map((i) => <tr key={i.id} className="border-b border-black/5"><td className="py-2">{i.title_snapshot} · {i.format} · {i.book_locale}</td><td>{i.quantity} × {formatMinor(i.unit_price_minor, "uk")}</td><td className="text-right">{formatMinor(i.line_total_minor, "uk")}</td></tr>)}</tbody>
          <tfoot><tr><td className="py-2 font-semibold" colSpan={2}>Разом (без доставки)</td><td className="text-right font-semibold">{formatMinor(o.total_minor, "uk")}</td></tr></tfoot></table>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {canConfirm && (
          <section className="card p-5">
            <h2 className="text-2xl">Підтвердити оплату вручну</h2>
            <p className="mt-1 text-sm text-ink-soft">Лише після звірки надходження {formatMinor(o.total_minor, "uk")} з призначенням «{o.number}». Запустить видачу PDF і підготовку до відправлення.</p>
            <ActionForm action={confirmPaymentAction} submit="Оплату звірено — підтвердити" className="mt-3">
              <input type="hidden" name="id" value={o.id} />
              <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="confirm" className="h-5 w-5" /> Я звірив(ла) суму й призначення платежу</label>
            </ActionForm>
          </section>
        )}
        {shipping && (
          <section className="card p-5">
            <h2 className="text-2xl">Доставка (Нова пошта)</h2>
            <ActionForm action={shippingAction} submit="Зберегти доставку" className="mt-3 grid gap-3">
              <input type="hidden" name="id" value={o.id} />
              <div className="field"><label htmlFor="ship-status">Статус</label><select id="ship-status" name="status" defaultValue={shipping.status === "awaiting_payment" ? "to_ship" : shipping.status} className="input">
                <option value="to_ship">Готується до відправлення</option><option value="shipped">Відправлено</option><option value="delivered">Доставлено</option><option value="cancelled">Скасовано</option></select></div>
              <div className="field"><label htmlFor="ttn">ТТН (номер накладної)</label><input id="ttn" name="ttn" inputMode="numeric" defaultValue={shipping.ttn ?? ""} className="input" /><p className="hint">Покупець побачить ТТН на сторінці статусу замовлення.</p></div>
            </ActionForm>
          </section>
        )}
        {digital && o.payment_status === "paid" && (
          <section className="card p-5">
            <h2 className="text-2xl">Електронна книжка</h2>
            <ActionForm action={resendPdfAction} submit="Надіслати лист із PDF повторно" className="mt-3"><input type="hidden" name="id" value={o.id} /></ActionForm>
            <ActionForm action={makeLinksAction} submit="Створити посилання для ручного надсилання" className="mt-4"><input type="hidden" name="id" value={o.id} /></ActionForm>
            <h3 className="mt-5 font-semibold">Журнал листів</h3>
            <ul className="mt-2 space-y-1 text-sm">{emails.map((e) => <li key={e.id}>{kyiv(e.created_at)} · {e.status} · спроб: {e.attempts}{e.last_error && ` · ${e.last_error}`}{e.next_attempt_at && ` · наступна: ${kyiv(e.next_attempt_at)}`}</li>)}{!emails.length && <li className="text-ink-soft">Немає</li>}</ul>
          </section>
        )}
        <section className="card p-5">
          <h2 className="text-2xl">Нотатка адміністратора</h2>
          <ActionForm action={orderNoteAction} submit="Зберегти нотатку" className="mt-3"><input type="hidden" name="id" value={o.id} /><textarea name="admin_note" rows={4} defaultValue={o.admin_note} className="input" aria-label="Нотатка" /></ActionForm>
        </section>
        <section className="card p-5">
          <h2 className="text-2xl">Події платежу</h2>
          <ul className="mt-2 space-y-1 text-sm">{events.map((e) => <li key={e.id}>{kyiv(e.created_at)} · {e.provider} · {e.reported_status} · {e.amount_minor != null && formatMinor(e.amount_minor, "uk")} {e.currency} → <strong>{e.result}</strong></li>)}{!events.length && <li className="text-ink-soft">Немає</li>}</ul>
        </section>
        {o.payment_status !== "cancelled" && (
          <section className="card p-5">
            <h2 className="text-2xl">Скасувати замовлення</h2>
            <p className="mt-1 text-sm text-ink-soft">Посилання на PDF буде відкликано. Повернення коштів виконується окремо у платіжному сервісі.</p>
            <ActionForm action={cancelOrderAction} submit="Скасувати" danger className="mt-3"><input type="hidden" name="id" value={o.id} />
              <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="confirm" className="h-5 w-5" /> Так, скасувати</label></ActionForm>
          </section>
        )}
      </div>
    </div>
  );
}
