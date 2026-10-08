"use client";
import Link from "next/link";
import { formatMinor } from "@/lib/money";
import type { Dict } from "@/i18n";
import { useQuote } from "./useQuote";

export default function CartView({ lang, t }: { lang: "uk" | "en"; t: Pick<Dict, "cart" | "formats" | "bookLocales"> }) {
  const { quote, removed, cart } = useQuote(lang);
  if (!cart.ready || (!quote && cart.lines.length)) return <p className="mt-8 text-ink-soft" role="status">{t.cart.loading}</p>;
  const lines = quote?.lines ?? [];
  return (
    <div className="mt-8">
      <div aria-live="polite">{removed && <p className="card mb-6 border-rose/40 p-4">{t.cart.unavailable}</p>}</div>
      {!lines.length ? (
        <div className="card p-8 text-center">
          <p className="text-lg text-ink-soft">{t.cart.empty}</p>
          <Link href={`/${lang}/books`} className="btn btn-primary mt-6">{t.cart.emptyCta}</Link>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-black/8 overflow-hidden rounded-[1.5rem] border border-black/6 bg-paper/80">
            {lines.map((l) => (
              <li key={l.variantId} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
                {l.coverBase && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${l.coverBase}-360.webp`} alt="" width={72} height={72} className="h-18 w-18 shrink-0 rounded-lg bg-cream object-contain" loading="lazy" />
                )}
                <div className="flex-1">
                  <Link href={`/${lang}/books/${l.slug}`} className="text-lg font-semibold hover:underline">{l.title}</Link>
                  <p className="text-ink-soft">{t.formats[l.format]} · {t.bookLocales[l.bookLocale]}</p>
                  {l.format === "pdf" && <p className="text-sm text-ink-soft">{t.cart.pdfQtyNote}</p>}
                </div>
                <div className="flex items-center gap-4">
                  {l.format === "print" ? (
                    <label className="flex items-center gap-2"><span className="text-sm text-ink-soft">{t.cart.qty}</span>
                      <select className="input !min-h-11 !w-20 !py-1" value={l.quantity} onChange={(e) => cart.setQty(l.variantId, Number(e.target.value))}>
                        {Array.from({ length: Math.max(1, l.maxQty) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                  ) : <span className="text-ink-soft">× 1</span>}
                  <p className="w-28 text-right font-semibold">{formatMinor(l.lineTotalMinor, lang)}</p>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => cart.remove(l.variantId)} aria-label={`${t.cart.remove}: ${l.title}, ${t.formats[l.format]}`}>{t.cart.remove}</button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col items-end gap-2">
            <p className="text-lg">{t.cart.subtotal}: <strong>{formatMinor(quote!.totalMinor, lang)}</strong></p>
            {quote!.shippingRequired && <p className="text-sm text-ink-soft">{t.cart.shippingNote}</p>}
            <Link href={`/${lang}/checkout`} className="btn btn-primary mt-4">{t.cart.checkout}</Link>
          </div>
        </>
      )}
    </div>
  );
}
