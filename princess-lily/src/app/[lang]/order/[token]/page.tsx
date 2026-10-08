import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, hasLocale } from "@/i18n";
import { orderByToken, orderDetails } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { formatMinor } from "@/lib/money";
import { claimPaidAction } from "../../actions";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Статус замовлення завжди з сервера. Доступ — за секретним токеном із URL (без списку замовлень). */
export default async function OrderPage({ params }: PageProps<"/[lang]/order/[token]">) {
  const { lang, token } = await params;
  if (!hasLocale(lang)) notFound();
  const o = await orderByToken(token);
  if (!o) notFound();
  const d = (await orderDetails(o.id))!;
  const t = getDict(lang);
  const s = await getSettings();
  const st = o.payment_status;
  const tone = st === "paid" ? "bg-moss-100 text-moss-900" : st === "failed" || st === "cancelled" ? "bg-rose-100 text-[#7d2d2a]" : "bg-cream text-ink";
  const note = lang === "uk" ? s.payment_link_note_uk : s.payment_link_note_en;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-5xl text-moss-900">{t.order.title} {o.number}</h1>
      <p className="mt-2 text-sm text-ink-soft">{t.order.keepLink}</p>
      <div className="card mt-8 p-6 sm:p-8" aria-live="polite">
        <dl className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <dt className="text-ink-soft">{t.order.payment}</dt>
          <dd><span className={`inline-flex rounded-full px-3 py-1 font-semibold ${tone}`}>{t.order.status[st]}</span></dd>
          {d.digital && (<><dt className="text-ink-soft">{t.order.digital}</dt><dd>{t.order.digitalStatus[d.digital.status] ?? d.digital.status}</dd></>)}
          {d.shipping && (<>
            <dt className="text-ink-soft">{t.order.delivery}</dt>
            <dd>{t.order.shippingStatus[d.shipping.status] ?? d.shipping.status}{o.np_city && <span className="block text-sm text-ink-soft">{o.np_city}, {o.np_point}</span>}</dd>
            {d.shipping.ttn && (<><dt className="text-ink-soft">{t.order.ttn}</dt><dd className="font-mono text-lg">{d.shipping.ttn}</dd></>)}
          </>)}
        </dl>

        {st === "pending_payment" && o.payment_mode === "manual_link" && s.payment_link_url && (
          <div className="mt-8 rounded-2xl bg-cream/70 p-5">
            <h2 className="text-2xl text-moss-900">{t.order.manualTitle}</h2>
            <p className="mt-2">{t.order.manualText(o.number, formatMinor(o.total_minor, lang))}</p>
            {note && <p className="mt-2 text-ink-soft">{note}</p>}
            <div className="mt-4 flex flex-wrap gap-3">
              <a href={s.payment_link_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">{t.order.payLink}</a>
              <form action={claimPaidAction.bind(null, token, lang)}><button className="btn btn-ghost">{t.order.claimPaid}</button></form>
            </div>
          </div>
        )}
        {st === "pending_verification" && o.payment_mode === "manual_link" && <p className="mt-6 text-ink-soft">{t.order.claimNote}</p>}
        {st === "pending_payment" && o.payment_mode === "provider" && (
          <div className="mt-6"><p className="text-ink-soft">{t.order.providerWaiting}</p>
            <Link href={`/${lang}/order/${token}`} className="btn btn-ghost btn-sm mt-3" prefetch={false}>{t.order.refresh}</Link></div>
        )}
        {st === "failed" && <p className="mt-6 text-ink-soft">{t.order.failedText}</p>}
      </div>

      <section className="card mt-6 p-6 sm:p-8" aria-labelledby="items-h">
        <h2 id="items-h" className="text-2xl text-moss-900">{t.order.items}</h2>
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
