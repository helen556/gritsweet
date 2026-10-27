import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, hasLocale } from "@/i18n";
import { orderByToken, orderDetails } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { formatMinor } from "@/lib/money";
import CopyAmount from "@/components/CopyAmount";
import ReceiptUpload from "@/components/ReceiptUpload";
import { db } from "@/db";
import Track from "@/components/tracking/Track";
import { purchaseEventId } from "@/lib/meta-capi";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Статус замовлення завжди з сервера. Доступ — за секретним токеном із URL (без списку замовлень). */
export default async function OrderPage({ params, searchParams }: PageProps<"/[lang]/order/[token]">) {
  const { lang, token } = await params;
  const payError = (await searchParams).pay === "error";
  if (!hasLocale(lang)) notFound();
  const o = await orderByToken(token);
  if (!o) notFound();
  const d = (await orderDetails(o.id))!;
  const t = getDict(lang);
  const s = await getSettings();
  const st = o.payment_status;
  const tone = st === "paid" ? "bg-plum-100 text-plum-900" : st === "failed" || st === "cancelled" ? "bg-rose-100 text-[#7d2d2a]" : "bg-cream text-ink";
  const note = lang === "uk" ? s.payment_link_note_uk : s.payment_link_note_en;
  const receipts = Number((await db.selectFrom("receipts").select(({ fn }) => fn.countAll<number>().as("n")).where("order_id", "=", o.id).executeTakeFirst())?.n ?? 0);
  // Фінальний екран: квитанцію отримано (ручна оплата) або оплату вже підтверджено
  const thanks = st === "paid" || (o.payment_mode === "manual_link" && st === "pending_verification" && receipts > 0);
  const receiptT = { title: t.order.receiptTitle, hint: t.order.receiptHint, upload: t.order.receiptUpload, ok: t.order.receiptOk, err: t.order.receiptErr, errSize: t.order.receiptErrSize, errType: t.order.receiptErrType, busy: t.order.receiptBusy };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      {thanks && (
        <section className="thanks card relative mb-8 overflow-hidden p-7 text-center sm:p-10" aria-labelledby="thanks-h">
          <span className="thanks__badge mx-auto grid h-20 w-20 place-items-center rounded-full" aria-hidden="true">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.2 4.2L19 7" /></svg>
          </span>
          <h1 id="thanks-h" className="mt-5 text-4xl text-plum-900 sm:text-5xl">{t.order.thanksTitle}</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg">{st === "paid" ? t.order.thanksPaid : t.order.thanksReceived}</p>
          {st !== "paid" && <p className="mx-auto mt-2 max-w-xl text-ink-soft">{d.shipping ? t.order.thanksNextPrint : o.pdf_channel === "telegram" ? t.order.thanksNextPdfTg : t.order.thanksNextPdf}</p>}
          <p className="mx-auto mt-6 max-w-lg font-display text-xl leading-snug text-plum-900">{t.order.thanksWish}</p>
        </section>
      )}
      {/* Purchase — лише після підтвердженої оплати; той самий eventID, що й у Conversions API (без дублів) */}
      {st === "paid" && <Track event="Purchase" eventId={purchaseEventId(o.id)} onceKey={`pl_px_${purchaseEventId(o.id)}`} params={{
        value: o.total_minor / 100, currency: o.currency, content_type: "product", content_ids: [...new Set(d.items.map((i) => i.product_id))],
        contents: d.items.map((i) => ({ id: i.product_id, quantity: i.quantity, item_price: i.unit_price_minor / 100 })), num_items: d.items.reduce((a, i) => a + i.quantity, 0),
      }} />}
      {thanks ? <h2 className="text-3xl text-plum-900">{t.order.title} {o.number}</h2> : <h1 className="text-5xl text-plum-900">{t.order.title} {o.number}</h1>}
      <p className="mt-2 text-sm text-ink-soft">{t.order.keepLink}</p>
      <div className="card mt-8 p-6 sm:p-8" aria-live="polite">
        <dl className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <dt className="text-ink-soft">{t.order.payment}</dt>
          <dd><span className={`inline-flex rounded-full px-3 py-1 font-semibold ${tone}`}>{t.order.status[st]}</span></dd>
          {d.digital && (<><dt className="text-ink-soft">{t.order.digital}</dt><dd>{d.digital.status === "manual" ? (o.pdf_channel === "telegram" ? t.order.digitalStatus.manualTelegram : t.order.digitalStatus.manualEmail) : (t.order.digitalStatus[d.digital.status] ?? d.digital.status)}</dd></>)}
          {d.shipping && (<>
            <dt className="text-ink-soft">{t.order.delivery}</dt>
            <dd>{t.order.shippingStatus[d.shipping.status] ?? d.shipping.status}{o.np_city && <span className="block text-sm text-ink-soft">{o.np_city}, {o.np_point}</span>}</dd>
            {d.shipping.ttn && (<><dt className="text-ink-soft">{t.order.ttn}</dt><dd className="font-mono text-lg">{d.shipping.ttn}</dd></>)}
          </>)}
        </dl>

        {st === "pending_payment" && o.payment_mode === "manual_link" && s.payment_link_url && (
          <div className="mt-8 rounded-2xl bg-cream/70 p-5">
            <h2 className="text-2xl text-plum-900">{t.order.manualTitle}</h2>
            <p className="mt-3 text-sm uppercase tracking-wider text-ink-soft">{t.order.toPay}</p>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-4xl font-semibold text-plum-900">{formatMinor(o.total_minor, lang)}</p>
              <CopyAmount value={(o.total_minor / 100).toFixed(2)} label={t.order.copyAmount} done={t.order.copied} />
            </div>
            <p className="mt-3">{t.order.manualText(o.number, formatMinor(o.total_minor, lang))}</p>
            {note && <p className="mt-2 text-ink-soft">{note}</p>}
            <div className="mt-4 flex flex-wrap gap-3">
              <a href={s.payment_link_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">{t.order.payLink} ↗</a>
            </div>
          </div>
        )}
        {o.payment_mode === "manual_link" && !thanks && (st === "pending_payment" || st === "pending_verification") && (
          <ReceiptUpload token={token} done={false} t={receiptT} />
        )}
        {o.payment_mode === "manual_link" && thanks && st === "pending_verification" && (
          <details className="mt-6 text-sm">
            <summary className="cursor-pointer text-ink-soft underline decoration-gold underline-offset-4">{t.order.thanksAddMore}</summary>
            <ReceiptUpload token={token} done={false} t={receiptT} />
          </details>
        )}
        {(st === "pending_payment" || st === "failed") && o.payment_mode === "provider" && (
          <div className="mt-6">
            <p className="text-ink-soft">{st === "failed" ? t.order.failedText : t.order.providerWaiting}</p>
            {payError && <p className="err mt-2" role="alert">{t.order.payError}</p>}
            <div className="mt-3 flex flex-wrap gap-3">
              {/* новий рахунок у платіжній системі (якщо попередній не створився, сплив або оплата не пройшла) */}
              <form method="post" action={`/${lang}/order/${token}/pay`}><button type="submit" className="btn btn-primary">{t.order.payLink}</button></form>
              <Link href={`/${lang}/order/${token}`} className="btn btn-ghost" prefetch={false}>{t.order.refresh}</Link>
            </div>
          </div>
        )}
        {st === "failed" && o.payment_mode !== "provider" && <p className="mt-6 text-ink-soft">{t.order.failedText}</p>}
      </div>

      <section className="card mt-6 p-6 sm:p-8" aria-labelledby="items-h">
        <h2 id="items-h" className="text-2xl text-plum-900">{t.order.items}</h2>
        <ul className="mt-4 space-y-3">
          {d.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-4">
              <span>{i.title_snapshot}<span className="block text-sm text-ink-soft">{t.formats[i.format]} · {t.bookLocales[i.book_locale]} × {i.quantity}</span></span>
              <span className="font-semibold">{formatMinor(i.line_total_minor, lang)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex justify-between border-t border-black/10 pt-4 text-lg"><span>{t.order.total}</span><strong>{formatMinor(o.total_minor, lang)}</strong></p>
        {o.shipping_required ? <p className="mt-1 text-right text-sm text-ink-soft">{t.checkout.shippingExtra}</p> : null}
      </section>
      <p className="mt-6"><Link className="underline decoration-gold underline-offset-4" href={`/${lang}/contacts`}>{t.order.help}</Link></p>
    </div>
  );
}
