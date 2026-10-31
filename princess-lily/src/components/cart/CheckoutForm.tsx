"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { placeOrder } from "@/app/[lang]/actions";
import { formatMinor } from "@/lib/money";
import type { Dict } from "@/i18n";
import { useQuote } from "./useQuote";
import NpPicker from "./NpPicker";
import PhoneInput from "./PhoneInput";
import { normalizeUaPhone } from "@/lib/ua-phone";
import Track from "../tracking/Track";
import { getConsent, metaCookies } from "../tracking/consent";
import type { CartLine } from "./CartProvider";

type T = Pick<Dict, "checkout" | "cart" | "formats" | "bookLocales">;

/** Оформлення: email+ім'я завжди; телефон і Нова пошта — лише якщо є друковані позиції (змішаний кошик підтримано). */
export default function CheckoutForm({ lang, t, npMode, direct }: { lang: "uk" | "en"; t: T; npMode: "api" | "manual"; direct?: CartLine[] | null }) {
  const { quote, cart, lines, ready } = useQuote(lang, direct);
  const [otherRecipient, setOtherRecipient] = useState(false);
  const [pdfChannel, setPdfChannel] = useState<"email" | "telegram">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<string[]>([]);
  const idem = useRef<string>("");
  const formRef = useRef<HTMLFormElement>(null);
  const e = t.checkout.errors;

  if (!ready || (!quote && lines.length)) return <p className="mt-8 text-ink-soft" role="status">{t.cart.loading}</p>;
  if (!quote?.lines.length) return (
    <div className="card mt-8 p-8 text-center"><p className="text-ink-soft">{t.cart.empty}</p><Link href={`/${lang}/books`} className="btn btn-primary mt-6">{t.cart.emptyCta}</Link></div>
  );
  const ship = quote.shippingRequired;
  const hasPdf = quote.lines.some((l) => l.format === "pdf");

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (busy) return;
    const fd = new FormData(ev.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "");
    const local: string[] = [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get("email").trim())) local.push("email");
    if (!get("firstName").trim()) local.push("firstName");
    if (!get("lastName").trim()) local.push("lastName");
    // телефон обов'язковий для будь-якого замовлення (і лише PDF теж)
    if (!normalizeUaPhone(get("phone"))) local.push("phone");
    if (hasPdf && pdfChannel === "telegram" && !/^@?[A-Za-z][A-Za-z0-9_]{3,31}$|^\+?[\d\s()-]{9,20}$/.test(get("telegram").trim())) local.push("telegram");
    if (ship) {
      if (!get("npCity").trim()) local.push("npCity");
      if (!get("npPoint").trim()) local.push("npPoint");
      if (otherRecipient && (!get("recipientFirstName").trim() || !get("recipientLastName").trim() || !normalizeUaPhone(get("recipientPhone")))) local.push("recipient");
    }
    setFields(local);
    if (local.length) { setError("invalid"); formRef.current?.querySelector<HTMLElement>(`[name="${local[0]}"]`)?.focus(); return; }
    setBusy(true); setError(null);
    if (!idem.current) idem.current = crypto.randomUUID() + "-" + Date.now().toString(36);
    const r = await placeOrder({
      lang, lines, expectedTotalMinor: quote!.totalMinor, idempotencyKey: idem.current,
      email: get("email"), firstName: get("firstName"), lastName: get("lastName"), phone: get("phone"),
      otherRecipient: ship && otherRecipient, recipientFirstName: get("recipientFirstName"), recipientLastName: get("recipientLastName"), recipientPhone: get("recipientPhone"), npCity: get("npCity"), npCityRef: get("npCityRef"),
      npPoint: get("npPoint"), npPointRef: get("npPointRef"), note: get("note"), website: get("website"),
      pdfChannel: hasPdf ? pdfChannel : "email", telegram: hasPdf && pdfChannel === "telegram" ? get("telegram") : "",
      // згода на рекламні cookie — для серверної події Purchase (Conversions API); без згоди нічого не передається
      ...(getConsent() === "granted" ? { adConsent: true, ...metaCookies() } : {}),
    }).catch(() => ({ ok: false as const, error: "generic" }));
    // «Купити зараз» не чіпає кошик; оформлення кошика — очищає його
    if (r.ok) { if (!direct) cart.clear(); window.location.assign(r.redirect); return; }
    setBusy(false);
    if (r.error !== "rate" && r.error !== "duplicate") idem.current = "";
    if ("fields" in r && r.fields) setFields(r.fields);
    setError(r.error);
  }
  const msg = error ? (error === "invalid" ? null : (e as Record<string, string>)[error] ?? e.generic) : null;
  const fe = (name: string, text: string) => fields.includes(name) ? <p id={`${name}-err`} className="err">{text}</p> : null;
  const inv = (name: string) => fields.includes(name) ? { "aria-invalid": true as const, "aria-describedby": `${name}-err` } : {};
  const req = <span aria-hidden="true" className="req">*</span>;
  // підсвітка знімається, щойно поле почали виправляти
  const clearOnInput = (ev: React.FormEvent<HTMLFormElement>) => {
    const n = (ev.target as HTMLInputElement).name;
    const key = n.startsWith("recipient") ? "recipient" : n;
    if (fields.includes(key)) setFields(fields.filter((x) => x !== key));
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} onInput={clearOnInput} noValidate className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <Track event="InitiateCheckout" params={{ content_ids: [...new Set(quote.lines.map((l) => l.productId))], contents: quote.lines.map((l) => ({ id: l.productId, quantity: l.quantity })), content_type: "product", num_items: quote.lines.reduce((a, l) => a + l.quantity, 0), value: quote.totalMinor / 100, currency: "UAH" }} />
      <div className="space-y-8">
        <fieldset className="card space-y-5 p-6 sm:p-8">
          <legend className="float-left mb-2 w-full font-display text-3xl text-plum-900">{t.checkout.contact}</legend>
          <p className="clear-both text-sm text-ink-soft"><span aria-hidden="true" className="req">*</span> {t.checkout.requiredNote}</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="field"><label htmlFor="lastName">{t.checkout.lastName}{req}</label>
              <input id="lastName" name="lastName" autoComplete="family-name" required className="input" {...inv("lastName")} />{fe("lastName", e.lastName)}</div>
            <div className="field"><label htmlFor="firstName">{t.checkout.firstName}{req}</label>
              <input id="firstName" name="firstName" autoComplete="given-name" required className="input" {...inv("firstName")} />{fe("firstName", e.name)}</div>
          </div>
          <div className="field"><label htmlFor="phone">{t.checkout.phone}{req}</label>
            <PhoneInput id="phone" name="phone" invalid={inv("phone")} />
            <p className="hint">{ship ? t.checkout.phoneHint : t.checkout.phoneHintPdf}</p>{fe("phone", e.phone)}</div>
          <div className="field"><label htmlFor="email">{t.checkout.email}{req}</label>
            <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required className="input" {...inv("email")} />
            <p className="hint">{t.checkout.emailHint}</p>{fe("email", e.email)}</div>
          {hasPdf && (
            <fieldset className="clear-both">
              <legend className="mb-2 font-semibold">{t.checkout.pdfWhere}</legend>
              <div className="flex flex-wrap gap-2">
                {(["email", "telegram"] as const).map((c) => (
                  <label key={c} className="chip"><input className="sr-only" type="radio" name="pdfChannel" value={c} checked={pdfChannel === c} onChange={() => setPdfChannel(c)} />{c === "email" ? t.checkout.pdfByEmail : t.checkout.pdfByTelegram}</label>
                ))}
              </div>
              {pdfChannel === "telegram" && (
                <div className="field mt-4"><label htmlFor="telegram">{t.checkout.telegram}</label>
                  <input id="telegram" name="telegram" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="@" required className="input" {...inv("telegram")} />
                  <p className="hint">{t.checkout.telegramHint}</p>{fe("telegram", e.telegram)}</div>
              )}
            </fieldset>
          )}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-px w-px opacity-0" />
        </fieldset>
        {ship ? (
          <fieldset className="card space-y-5 p-6 sm:p-8">
            <legend className="float-left mb-2 w-full font-display text-3xl text-plum-900">{t.checkout.delivery}</legend>
            <p className="clear-both text-ink-soft">{t.checkout.deliveryNote}</p>
            <NpPicker mode={npMode} t={t.checkout} invalid={fields} />
            <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5" checked={otherRecipient} onChange={(ev) => setOtherRecipient(ev.target.checked)} /> {t.checkout.otherRecipient}</label>
            {otherRecipient && (
              <div className="grid gap-4 rounded-2xl bg-cream/50 p-4 sm:grid-cols-2" role="group" aria-label={t.checkout.recipient}>
                <div className="field"><label htmlFor="recipientFirstName">{t.checkout.recFirst}</label><input id="recipientFirstName" name="recipientFirstName" autoComplete="off" className="input" {...inv("recipient")} /></div>
                <div className="field"><label htmlFor="recipientLastName">{t.checkout.recLast}</label><input id="recipientLastName" name="recipientLastName" autoComplete="off" className="input" {...inv("recipient")} /></div>
                <div className="field sm:col-span-2"><label htmlFor="recipientPhone">{t.checkout.recPhone}</label><PhoneInput id="recipientPhone" name="recipientPhone" autoComplete="off" invalid={inv("recipient")} /></div>
                {fe("recipient", e.recipient)}
              </div>
            )}
          </fieldset>
        ) : <p className="card p-5 text-ink-soft">{t.checkout.digitalOnly}</p>}
        <div className="field"><label htmlFor="note">{t.checkout.note}</label><textarea id="note" name="note" rows={3} className="input" maxLength={1000} /></div>
      </div>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card p-6 sm:p-8">
          <h2 className="text-3xl text-plum-900">{t.checkout.summary}</h2>
          {direct && <p className="mt-2 rounded-xl bg-plum-100/70 px-3 py-2 text-sm">{t.checkout.buyNowNote}</p>}
          <ul className="mt-4 space-y-3">
            {quote.lines.map((l) => (
              <li key={l.variantId} className="flex justify-between gap-4">
                <span><span className="font-medium">{l.title}</span><br /><span className="text-sm text-ink-soft">{t.formats[l.format]} · {t.bookLocales[l.bookLocale]} × {l.quantity}</span></span>
                <span className="shrink-0 font-semibold">{formatMinor(l.lineTotalMinor, lang)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-black/10 pt-4">
            <p className="flex justify-between text-lg"><span>{t.checkout.total}</span><strong>{formatMinor(quote.totalMinor, lang)}</strong></p>
            {ship && <p className="mt-1 text-right text-sm text-ink-soft">{t.checkout.shippingExtra}</p>}
          </div>
          <div aria-live="assertive" className="mt-4">{(msg || (error === "invalid" && fields.length > 0)) && <p className="err" role="alert">{msg ?? (lang === "uk" ? "Перевірте позначені поля." : "Please check the highlighted fields.")}</p>}</div>
          <button type="submit" className="btn btn-primary mt-4 w-full" disabled={busy} aria-busy={busy}>{busy ? t.checkout.submitting : t.checkout.submit}</button>
          <p className="mt-3 text-sm text-ink-soft">{t.checkout.consent}{" "}
            <Link className="underline" href={`/${lang}/offer`}>{lang === "uk" ? "Оферта" : "Offer"}</Link> · <Link className="underline" href={`/${lang}/privacy`}>{lang === "uk" ? "Конфіденційність" : "Privacy"}</Link></p>
        </div>
      </aside>
    </form>
  );
}
