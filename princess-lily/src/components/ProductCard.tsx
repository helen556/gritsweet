import Link from "next/link";
import Picture from "./Picture";
import type { CatalogProduct } from "@/lib/catalog";
import type { Dict } from "@/i18n";
import { formatMinor } from "@/lib/money";

export function priceLabel(p: CatalogProduct, lang: "uk" | "en", t: Dict) {
  const prices = p.variants.filter((v) => v.sellable).map((v) => v.price_minor!);
  if (!prices.length) return { text: t.product.comingSoon, soon: true };
  const min = Math.min(...prices);
  const all = prices.every((x) => x === min);
  return { text: `${all ? "" : lang === "uk" ? "від " : "from "}${formatMinor(min, lang)}`, soon: false };
}

export default function ProductCard({ p, lang, t, headingLevel = "h3" }: { p: CatalogProduct; lang: "uk" | "en"; t: Dict; headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  const price = priceLabel(p, lang, t);
  const langs = [...new Set(p.variants.map((v) => v.book_locale))];
  const formats = [...new Set(p.variants.map((v) => v.format))];
  return (
    <article className="card group relative flex h-full flex-col overflow-hidden transition-[transform,box-shadow] duration-300 ease-[var(--ease-soft)] hover:-translate-y-1 hover:shadow-[0_26px_50px_-30px_rgba(38,61,45,.55)]">
      <div className="bg-cream/70 p-5 sm:p-6">
        {p.cover_base && (
          <Picture base={p.cover_base} widths={p.widths} width={p.cover_width ?? 1} height={p.cover_height ?? 1} alt={p.coverAlt}
            sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 90vw" imgClassName="mx-auto aspect-square w-full rounded-xl object-contain shadow-[0_14px_30px_-18px_rgba(0,0,0,.45)]" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
        <H className="text-2xl text-moss-900">
          <Link href={`/${lang}/books/${p.slug}`} className="after:absolute after:inset-0 after:content-['']" lang={p.translationConfirmed ? undefined : "uk"}>{p.title}</Link>
        </H>
        <ul className="flex flex-wrap gap-2 text-sm text-ink-soft">
          {p.age_from != null && p.age_to != null && <li className="rounded-full bg-moss-100 px-3 py-1">{t.product.age(p.age_from, p.age_to)}</li>}
          {langs.map((l) => <li key={l} className="rounded-full bg-moss-100 px-3 py-1">{t.bookLocales[l]}</li>)}
          {formats.map((f) => <li key={f} className="rounded-full bg-rose-100/80 px-3 py-1">{t.formats[f]}</li>)}
        </ul>
        <p className={`mt-auto pt-2 text-lg font-semibold ${price.soon ? "text-copper" : "text-ink"}`}>{price.text}</p>
      </div>
    </article>
  );
}
