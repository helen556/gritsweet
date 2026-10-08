"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart } from "./CartProvider";
import { formatMinor } from "@/lib/money";
import type { Dict } from "@/i18n";

type V = { id: string; bookLocale: "uk" | "en"; format: "pdf" | "print"; priceMinor: number | null; stock: number | null; sellable: boolean; restockNote: string | null };

/** Вибір мови книжки та формату (окремо від мови сайту) і додавання в кошик. Ціна тут — лише для показу. */
export default function AddToCart({ lang, t, variants }: { lang: "uk" | "en"; t: { product: Omit<Dict["product"], "age">; formats: Dict["formats"]; bookLocales: Dict["bookLocales"] }; variants: V[] }) {
  const cart = useCart();
  const first = variants.find((v) => v.sellable) ?? variants[0];
  const [bl, setBl] = useState(first.bookLocale);
  const [fmt, setFmt] = useState(first.format);
  const [added, setAdded] = useState(false);
  const langs = [...new Set(variants.map((v) => v.bookLocale))];
  const formats = [...new Set(variants.map((v) => v.format))];
  const sel = useMemo(() => variants.find((v) => v.bookLocale === bl && v.format === fmt), [variants, bl, fmt]);

  return (
    <div className="card p-6">
      <fieldset>
        <legend className="mb-2 font-semibold">{t.product.languageLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {langs.map((l) => (
            <label key={l} className="chip"><input className="sr-only" type="radio" name="bl" value={l} checked={bl === l} onChange={() => { setBl(l); setAdded(false); }} />{t.bookLocales[l]}</label>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-5">
        <legend className="mb-2 font-semibold">{t.product.formatLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {formats.map((f) => {
            const exists = variants.some((v) => v.bookLocale === bl && v.format === f);
            return <label key={f} className="chip"><input className="sr-only" type="radio" name="fmt" value={f} disabled={!exists} checked={fmt === f} onChange={() => { setFmt(f); setAdded(false); }} />{t.formats[f]}</label>;
          })}
        </div>
      </fieldset>
      <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1" aria-live="polite">
        {sel?.sellable ? (
          <>
            <p className="text-3xl font-semibold">{formatMinor(sel.priceMinor!, lang)}</p>
            <p className="text-ink-soft">{sel.format === "pdf" ? t.product.digital : t.product.inStock}</p>
          </>
        ) : (
          <>
            <p className="text-2xl font-semibold text-copper">{sel?.format === "print" && sel.priceMinor ? t.product.outOfStock : t.product.comingSoon}</p>
            {sel?.restockNote && <p className="w-full text-ink-soft">{sel.restockNote}</p>}
          </>
        )}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" disabled={!sel?.sellable}
          onClick={() => { if (sel?.sellable) { cart.add(sel.id); setAdded(true); } }}>
          {t.product.add}
        </button>
        {added && <Link href={`/${lang}/cart`} className="btn btn-ghost">{t.product.goCart}</Link>}
      </div>
      <p className="sr-only" aria-live="polite">{added ? t.product.added : ""}</p>
    </div>
  );
}
