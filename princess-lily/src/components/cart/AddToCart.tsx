"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "./CartProvider";
import { formatMinor } from "@/lib/money";
import { trackPixel } from "../tracking/consent";
import type { Dict } from "@/i18n";

type V = { id: string; bookLocale: "uk" | "en"; format: "pdf" | "print"; priceMinor: number | null; stock: number | null; sellable: boolean; restockNote: string | null };

/**
 * Сценарій покупки (уточнення від 09.10.2026):
 * 1) «Мова книжки» — лише доступні мови; 2) «Формат» — лише доступні для мови; 3) ціна й наявність оновлюються;
 * до вибору валідного варіанта покупка неактивна; 4) «Купити зараз» — оформлення лише цієї книжки, кошик не змінюється;
 * 5) «Додати в кошик» — з підтвердженням і кількістю в кошику. Ціна тут лише для показу; сума рахується на сервері.
 */
export default function AddToCart({ lang, t, variants, product, onLocaleChange, onFormatChange }: { lang: "uk" | "en"; t: { product: Omit<Dict["product"], "age">; formats: Dict["formats"]; bookLocales: Dict["bookLocales"] }; variants: V[]; product: { id: string; title: string }; onLocaleChange?: (l: "uk" | "en") => void; onFormatChange?: (f: "pdf" | "print" | null) => void }) {
  const cart = useCart();
  const router = useRouter();
  const available = variants.filter((v) => v.sellable);
  const langs = [...new Set(available.map((v) => v.bookLocale))];
  const [bl, setBl] = useState<V["bookLocale"] | null>(langs.length === 1 ? langs[0] : null);
  const formatsFor = (l: V["bookLocale"] | null) => [...new Set(available.filter((v) => v.bookLocale === l).map((v) => v.format))];
  const fmts = formatsFor(bl);
  const [fmt, setFmt] = useState<V["format"] | null>(fmts.length === 1 ? fmts[0] : null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const sel = available.find((v) => v.bookLocale === bl && v.format === fmt) ?? null;
  const maxQty = sel?.format === "print" ? Math.min(10, sel.stock ?? 1) : 1;
  const inCart = sel ? cart.lines.find((l) => l.variantId === sel.id)?.quantity ?? 0 : 0;

  const chooseLang = (l: V["bookLocale"]) => {
    setBl(l); setAdded(false); setQty(1); onLocaleChange?.(l);
    const f = formatsFor(l);
    pickFormat(f.length === 1 ? f[0] : f.includes(fmt as V["format"]) ? fmt : null);
  };
  const pickFormat = (f: V["format"] | null) => { setFmt(f); onFormatChange?.(f); };
  // ціна до вибору формату: найменша ціна кожного формату (для обраної мови, якщо її вже вибрано)
  const formatPrices = (["print", "pdf"] as const).flatMap((f) => {
    const ps = available.filter((v) => v.format === f && (!bl || v.bookLocale === bl)).map((v) => v.priceMinor!);
    return ps.length ? [{ f, min: Math.min(...ps) }] : [];
  });

  return (
    <div className="card p-6">
      <fieldset>
        <legend className="mb-2 font-semibold">{t.product.languageLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {langs.map((l) => (
            <label key={l} className="chip"><input className="sr-only" type="radio" name="bl" value={l} checked={bl === l} onChange={() => chooseLang(l)} /><strong>{l === "uk" ? "UA" : "EN"}</strong><span className="opacity-80">{t.bookLocales[l]}</span></label>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-5" disabled={!bl}>
        <legend className="mb-2 font-semibold">{t.product.formatLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {(bl ? fmts : [...new Set(available.map((v) => v.format))]).map((f) => (
            <label key={f} className="chip"><input className="sr-only" type="radio" name="fmt" value={f} disabled={!bl} checked={fmt === f} onChange={() => { pickFormat(f); setAdded(false); setQty(1); }} />{t.formats[f]}</label>
          ))}
        </div>
        {available.some((v) => v.format === "pdf") && <p className="mt-3 flex gap-2 text-sm text-ink-soft"><span aria-hidden="true">📱</span><span>{t.product.pdfHint}</span></p>}
      </fieldset>

      <div className="mt-6 min-h-[4.5rem]" aria-live="polite">
        {sel ? (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="text-3xl font-semibold">{formatMinor(sel.priceMinor! * qty, lang)}</p>
            <p className="text-ink-soft">{sel.format === "pdf" ? t.product.digital : `${t.product.inStock}${sel.stock != null && sel.stock <= 10 ? ` · ${sel.stock}` : ""}`}</p>
          </div>
        ) : (
          <>
            <ul className="space-y-0.5">
              {formatPrices.map((x) => <li key={x.f}><span className="text-2xl font-semibold">{formatMinor(x.min, lang)}</span> <span className="text-ink-soft">— {t.formats[x.f]}</span></li>)}
            </ul>
            <p className="mt-1 text-sm text-ink-soft">{t.product.chooseVariant}</p>
          </>
        )}
      </div>

      {sel?.format === "print" && maxQty > 1 && (
        <label className="mt-2 flex items-center gap-3"><span className="text-sm">{lang === "uk" ? "Кількість" : "Quantity"}</span>
          <select className="input !min-h-11 !w-24" value={qty} onChange={(e) => setQty(Number(e.target.value))}>
            {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" disabled={!sel}
          onClick={() => { if (sel) router.push(`/${lang}/checkout?buy=${encodeURIComponent(sel.id)}&qty=${qty}`); }}>
          {t.product.buyNow}
        </button>
        <button type="button" className="btn btn-ghost" disabled={!sel}
          onClick={() => {
            if (!sel) return;
            cart.add(sel.id, qty); setAdded(true);
            trackPixel("AddToCart", { content_ids: [product.id], content_name: product.title, content_type: "product", contents: [{ id: product.id, quantity: qty }], value: (sel.priceMinor! * qty) / 100, currency: "UAH" });
          }}>
          {t.product.add}
        </button>
      </div>
      <div aria-live="polite" className="mt-4 min-h-6">
        {added && sel && (
          <p className="flex flex-wrap items-center gap-3 rounded-xl bg-plum-100/70 px-4 py-3">
            <span>✓ {t.product.added}. {t.product.inCart}: <strong>{inCart}</strong></span>
            <Link href={`/${lang}/cart`} className="font-semibold underline decoration-gold underline-offset-4">{t.product.goCart}</Link>
          </p>
        )}
      </div>
    </div>
  );
}
