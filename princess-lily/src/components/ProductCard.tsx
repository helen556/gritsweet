import Link from "next/link";
import Picture from "./Picture";
import manifest from "@/lib/media-manifest.json";
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

/** Ціна для кожного формату окремо: «399 грн — друкована», «299 грн — PDF» (найменша ціна серед мовних версій). */
export function priceByFormat(p: CatalogProduct, lang: "uk" | "en", t: Dict) {
  return (["print", "pdf"] as const).flatMap((f) => {
    const ps = p.variants.filter((v) => v.sellable && v.format === f).map((v) => v.price_minor!);
    return ps.length ? [{ f, text: formatMinor(Math.min(...ps), lang), label: f === "pdf" ? t.product.cardPdf : t.product.cardPrint }] : [];
  });
}

/**
 * Картка книжки. Телефон: горизонтальна (обкладинка ~42% ширини, назва поруч) — усі книжки на сторінці, читабельно.
 * ≥ 640 px: вертикальна. Обкладинка — для мови сайту (або загальна), повністю (object-contain).
 */
export default function ProductCard({ p, lang, t, headingLevel = "h3" }: { p: CatalogProduct; lang: "uk" | "en"; t: Dict; headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  const price = priceLabel(p, lang, t);
  const shown = p.variants.some((v) => v.sellable) ? p.variants.filter((v) => v.sellable) : p.variants;
  const langs = [...new Set(shown.map((v) => v.book_locale))];
  const formats = [...new Set(shown.map((v) => v.format))];
  const c = p.cover!;
  return (
    <article className="book-card group relative grid h-full grid-cols-[42%_1fr] items-center gap-4 sm:flex sm:flex-col sm:items-stretch sm:gap-0">
      <div className="book-card__cover relative sm:px-6 sm:pt-6">
        <Picture base={c.base} widths={c.widths} width={c.width} height={c.height} alt={c.alt || p.coverAlt}
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 44vw, 42vw"
          imgClassName="mx-auto aspect-square h-auto w-full rounded-[1.1rem] object-contain shadow-[0_18px_34px_-22px_rgba(105,72,86,.55)] transition-transform duration-500 ease-[var(--ease-soft)] group-hover:-translate-y-1" />
      </div>
      <div className="flex min-w-0 flex-col gap-2 py-2 pr-1 sm:flex-1 sm:gap-3 sm:p-6">
        <H className="text-[1.3rem] leading-snug text-plum-900 sm:text-2xl">
          <Link href={`/${lang}/books/${p.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none" lang={p.translationConfirmed ? undefined : "uk"}>{p.title}</Link>
        </H>
        <ul className="flex flex-wrap gap-1.5 text-[0.82rem] text-ink-soft sm:gap-2 sm:text-sm">
          {langs.map((l) => <li key={l} className="rounded-full bg-plum-100/80 px-2.5 py-0.5">{l === "uk" ? "UA" : "EN"}</li>)}
          {formats.map((f) => <li key={f} className="rounded-full bg-rose-100/70 px-2.5 py-0.5">{f === "pdf" ? "PDF" : t.formats.print}</li>)}
        </ul>
        {price.soon ? <p className="mt-auto pt-1 text-lg font-semibold text-copper">{price.text}</p> : (
          <ul className="mt-auto space-y-0.5 pt-1">
            {priceByFormat(p, lang, t).map((x) => <li key={x.f} className="text-ink"><span className="text-lg font-semibold">{x.text}</span> <span className="text-sm text-ink-soft">/ {x.label}</span></li>)}
          </ul>
        )}
      </div>
    </article>
  );
}

/** Картка-заглушка в кінці каталогу: «Незабаром з’являться нові історії» (без посилання, не товар). */
export function ComingSoonCard({ text }: { text: string }) {
  const lp = manifest["lily-portrait"];
  return (
    <div className="book-card book-card--soon relative grid h-full grid-cols-[42%_1fr] items-center gap-4 sm:flex sm:flex-col sm:items-stretch sm:gap-0">
      <div className="book-card__cover relative sm:px-6 sm:pt-6">
        <div className="soon-art relative mx-auto grid aspect-square w-full place-items-center rounded-[1.1rem]">
          <Picture base="/media/lily-portrait" widths={lp.widths} width={lp.width} height={lp.height} alt=""
            sizes="(min-width: 1024px) 220px, (min-width: 640px) 28vw, 30vw" className="block w-[68%]"
            imgClassName="aspect-square h-auto w-full rounded-full object-cover [mask-image:radial-gradient(closest-side,#000_74%,transparent)]" />
          <span className="soon-art__spark" aria-hidden="true" /><span className="soon-art__spark" aria-hidden="true" /><span className="soon-art__spark" aria-hidden="true" />
        </div>
      </div>
      <div className="flex min-w-0 flex-col justify-center py-2 pr-1 sm:flex-1 sm:p-6">
        <p className="font-display text-[1.3rem] leading-snug text-plum-900 sm:text-2xl">{text}</p>
      </div>
    </div>
  );
}
