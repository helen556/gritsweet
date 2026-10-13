"use client";
import { useState } from "react";
import AddToCart from "./AddToCart";
import type { Dict } from "@/i18n";

type Cover = { base: string; widths: number[]; width: number; height: number; alt: string } | null;
type V = Parameters<typeof AddToCart>[0]["variants"][number];

function CoverImg({ c, priority }: { c: NonNullable<Cover>; priority?: boolean }) {
  const set = (ext: string) => c.widths.map((w) => `${c.base}-${w}.${ext} ${w}w`).join(", ");
  return (
    <picture>
      <source type="image/avif" srcSet={set("avif")} sizes="(min-width: 1024px) 560px, 92vw" />
      <source type="image/webp" srcSet={set("webp")} sizes="(min-width: 1024px) 560px, 92vw" />
      { }
      <img src={`${c.base}-${c.widths[Math.min(1, c.widths.length - 1)]}.webp`} alt={c.alt} width={c.width} height={c.height}
        loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} className="mx-auto h-auto w-full rounded-[1.25rem] object-contain shadow-[0_26px_50px_-30px_rgba(0,0,0,.55)]" />
    </picture>
  );
}

/**
 * Сторінка книжки: обкладинка відповідає обраній мові (UA/EN), поруч — інформація й панель покупки.
 * Якщо книжка ще не продається — лишається перемикач мови для обкладинки й блок «Незабаром».
 */
export default function ProductBuy({ lang, t, covers, variants, comingSoon, children }: {
  lang: "uk" | "en"; t: { product: Omit<Dict["product"], "age">; formats: Dict["formats"]; bookLocales: Dict["bookLocales"] };
  covers: { uk: Cover; en: Cover }; variants: V[]; comingSoon: { title: string; note: string }; children: React.ReactNode;
}) {
  const sellable = variants.some((v) => v.sellable);
  const coverLocales = (["uk", "en"] as const).filter((l) => covers[l]);
  const [loc, setLoc] = useState<"uk" | "en">(covers[lang] ? lang : coverLocales[0] ?? "uk");
  const shown = covers[loc] ?? covers.uk ?? covers.en;
  const distinct = !!covers.uk && !!covers.en && covers.uk.base !== covers.en.base;

  return (
    <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14">
      <figure className="self-start lg:sticky lg:top-24">
        <div className="relative">
          {shown && <div key={shown.base} className="animate-[cover-in_.45s_var(--ease-soft)_both]"><CoverImg c={shown} priority /></div>}
        </div>
      </figure>
      <div>
        {children}
        <div className="mt-8">
          {sellable ? (
            <AddToCart lang={lang} t={t} variants={variants} onLocaleChange={setLoc} />
          ) : (
            <div className="card p-6">
              {distinct && (
                <div role="group" aria-label={t.product.languageLabel} className="mb-4 flex flex-wrap gap-2">
                  {coverLocales.map((l) => (
                    <button key={l} type="button" className="chip" aria-pressed={loc === l} onClick={() => setLoc(l)}><strong>{l === "uk" ? "UA" : "EN"}</strong><span className="opacity-80">{t.bookLocales[l]}</span></button>
                  ))}
                </div>
              )}
              <p className="text-2xl font-semibold text-copper">{comingSoon.title}</p>
              <p className="mt-2 text-ink-soft">{comingSoon.note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
