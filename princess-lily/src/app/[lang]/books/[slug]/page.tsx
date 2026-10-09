import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, hasLocale } from "@/i18n";
import { getPublicProduct } from "@/lib/catalog";
import Picture from "@/components/Picture";
import AddToCart from "@/components/cart/AddToCart";
import { pageMeta, siteUrl } from "@/lib/seo";
import { priceLabel } from "@/components/ProductCard";

export async function generateMetadata({ params }: PageProps<"/[lang]/books/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) return {};
  const p = await getPublicProduct(slug, lang);
  if (!p) return {};
  const t = getDict(lang);
  const desc = p.description ? p.description.slice(0, 160) : `${t.brand.name}. ${t.product.age(p.age_from ?? 2, p.age_to ?? 6)}.`;
  const img = p.cover_base ? `${p.cover_base}-${p.widths[Math.min(2, p.widths.length - 1)]}.webp` : undefined;
  return pageMeta(lang, `/books/${slug}`, p.title, desc, { image: img });
}

export default async function BookPage({ params }: PageProps<"/[lang]/books/[slug]">) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  const p = await getPublicProduct(slug, lang);
  if (!p) notFound();
  const t = getDict(lang);
  const sellable = p.variants.filter((v) => v.sellable);
  // у характеристиках — лише варіанти, які реально доступні (або всі заплановані, поки нічого не продається)
  const shown = sellable.length ? sellable : p.variants;
  const price = priceLabel(p, lang, t);
  // у клієнтський компонент — лише рядки (без функцій)
  const { age: _age, ...productStrings } = t.product;
  void _age;

  // Schema.org Product/Offer — лише для опублікованих товарів із реальною ціною; без рейтингів
  const jsonLd = p.status === "published" && sellable.length ? {
    "@context": "https://schema.org", "@type": "Product", name: p.title,
    image: p.cover_base ? `${siteUrl()}${p.cover_base}-${p.widths.at(-1)}.webp` : undefined,
    description: p.description || undefined,
    offers: sellable.map((v) => ({
      "@type": "Offer", price: (v.price_minor! / 100).toFixed(2), priceCurrency: v.currency,
      availability: "https://schema.org/InStock", url: `${siteUrl()}/${lang}/books/${p.slug}`,
      itemCondition: "https://schema.org/NewCondition",
    })),
  } : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href={`/${lang}/books`} className="inline-flex min-h-11 items-center text-ink-soft hover:text-moss-900">{t.product.back}</Link>
      <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14">
        <figure className="card self-start bg-cream/70 p-4 sm:p-8">
          {p.cover_base && (
            <Picture base={p.cover_base} widths={p.widths} width={p.cover_width ?? 1} height={p.cover_height ?? 1} alt={p.coverAlt} priority
              sizes="(min-width: 1024px) 600px, 92vw" imgClassName="mx-auto h-auto w-full rounded-xl object-contain shadow-[0_20px_40px_-24px_rgba(0,0,0,.5)]" />
          )}
          {t.product.coverNote && <figcaption className="mt-3 text-center text-sm text-ink-soft">{t.product.coverNote}</figcaption>}
        </figure>
        <div>
          <h1 className="text-4xl text-moss-900 sm:text-5xl" lang={p.translationConfirmed ? undefined : "uk"}>{p.title}</h1>
          {!p.translationConfirmed && t.product.originalTitleNote && <p className="mt-2 text-sm text-ink-soft">{t.product.originalTitleNote}</p>}
          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[1.02rem]">
            {p.age_from != null && p.age_to != null && (<><dt className="text-ink-soft">{t.product.ageLabel}</dt><dd>{t.product.age(p.age_from, p.age_to)}</dd></>)}
            <dt className="text-ink-soft">{t.product.languageLabel}</dt><dd>{[...new Set(shown.map((v) => t.bookLocales[v.book_locale]))].join(", ")}</dd>
            <dt className="text-ink-soft">{t.product.formatLabel}</dt><dd>{[...new Set(shown.map((v) => t.formats[v.format]))].join(", ")}</dd>
            {p.pages != null && (<><dt className="text-ink-soft">{t.product.pages}</dt><dd>{p.pages}</dd></>)}
            {p.size_label && (<><dt className="text-ink-soft">{t.product.size}</dt><dd>{p.size_label}</dd></>)}
            {p.binding_label && (<><dt className="text-ink-soft">{t.product.binding}</dt><dd>{p.binding_label}</dd></>)}
          </dl>
          <div className="mt-8">
            {sellable.length ? (
              <AddToCart lang={lang} t={{ product: productStrings, formats: t.formats, bookLocales: t.bookLocales }}
                variants={p.variants.map((v) => ({ id: v.id, bookLocale: v.book_locale, format: v.format, priceMinor: v.price_minor, stock: v.stock, sellable: v.sellable, restockNote: v.restock_note }))} />
            ) : (
              <div className="card p-6">
                <p className="text-2xl font-semibold text-copper">{price.text}</p>
                <p className="mt-2 text-ink-soft">{t.product.comingSoonNote}</p>
              </div>
            )}
          </div>
          <div className="prose-soft mt-10 max-w-[62ch] text-ink-soft">
            {p.description ? p.description.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>) : <p>{t.product.descriptionPending}</p>}
          </div>
        </div>
      </div>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
    </div>
  );
}
