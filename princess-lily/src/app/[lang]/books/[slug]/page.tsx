import Link from "next/link";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getDict, hasLocale } from "@/i18n";
import { getPublicProduct, redirectedSlug } from "@/lib/catalog";
import { BUNDLES, bookSpecRows, SERIES_SPECS } from "@/lib/book-specs";
import ProductBuy from "@/components/cart/ProductBuy";
import Spreads from "@/components/Spreads";
import { breadcrumbLd, orgId, pageMeta, siteUrl } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import Track from "@/components/tracking/Track";
import { priceLabel } from "@/components/ProductCard";

export async function generateMetadata({ params }: PageProps<"/[lang]/books/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) return {};
  const p = await getPublicProduct(slug, lang);
  if (!p) return {};
  const t = getDict(lang);
  const desc = p.description ? clip(p.description.replace(/\s+/g, " "), 160) : `${p.title}. ${t.seo.orgDescription}`;
  const img = p.cover ? `${p.cover.base}-${p.cover.widths[Math.min(2, p.cover.widths.length - 1)]}.webp` : undefined;
  return pageMeta(lang, `/books/${slug}`, p.title, desc, { image: img, imageAlt: `${p.title} — ${t.brand.name}` });
}

/** Обрізає опис до межі слова, щоб сніпет у пошуку не обривався посеред слова. */
function clip(s: string, max: number) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 30)).replace(/[\s,;:—-]+$/, "") + "…";
}

export default async function BookPage({ params }: PageProps<"/[lang]/books/[slug]">) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  const p = await getPublicProduct(slug, lang);
  if (!p) {
    const moved = await redirectedSlug(slug);
    if (moved) permanentRedirect(`/${lang}/books/${moved}`);
    notFound();
  }
  const t = getDict(lang);
  const sellable = p.variants.filter((v) => v.sellable);
  // у характеристиках — лише варіанти, які реально доступні (або всі заплановані, поки нічого не продається)
  const shown = sellable.length ? sellable : p.variants;
  const price = priceLabel(p, lang, t);
  // у клієнтський компонент — лише рядки (без функцій)
  const { age: _age, ...productStrings } = t.product;
  void _age;
  const { pagesEach: _pe, ...specStrings } = t.specs;
  void _pe;
  const specs = bookSpecRows(t, p, [...new Set(shown.map((v) => v.book_locale))], [...new Set(shown.map((v) => v.format))]);
  const bundle = BUNDLES[p.id];

  // Schema.org: книжка (Book) і, якщо вона реально продається, товар (Product) з пропозиціями за фактичними цінами й форматами; без рейтингів
  const url = `${siteUrl()}/${lang}/books/${p.slug}`;
  const offers = p.status === "published" ? sellable.filter((v) => v.price_minor != null).map((v) => ({
    "@type": "Offer", name: `${t.formats[v.format]} · ${t.bookLocales[v.book_locale]}`, sku: v.id,
    price: (v.price_minor! / 100).toFixed(2), priceCurrency: v.currency,
    availability: "https://schema.org/InStock", itemCondition: "https://schema.org/NewCondition",
    ...(v.format === "pdf" ? {} : { shippingDetails: { "@type": "OfferShippingDetails", shippingDestination: { "@type": "DefinedRegion", addressCountry: "UA" } } }),
    url, seller: { "@id": orgId() },
  })) : [];
  const bookLd = {
    "@type": offers.length ? ["Book", "Product"] : "Book", "@id": `${url}#book`, name: p.title, url,
    image: p.cover ? `${siteUrl()}${p.cover.base}-${p.cover.widths.at(-1)}.webp` : undefined,
    description: p.description || undefined,
    inLanguage: [...new Set(p.variants.map((v) => v.book_locale))].map((l) => (l === "uk" ? "uk-UA" : l)),
    author: { "@type": "Person", name: t.author.name },
    isPartOf: { "@type": "BookSeries", name: t.brand.name },
    genre: t.specs.categoryValue,
    bookFormat: [...new Set(shown.map((v) => (v.format === "pdf" ? "https://schema.org/EBook" : "https://schema.org/Paperback")))],
    publisher: { "@id": orgId() },
    ...(p.age_from != null && p.age_to != null ? { typicalAgeRange: `${p.age_from}-${p.age_to}` } : {}),
    ...(!bundle ? { numberOfPages: p.pages ?? SERIES_SPECS.pages } : {}),
    ...(offers.length ? { brand: { "@type": "Brand", name: t.brand.name }, offers } : {}),
  };
  const crumbs = breadcrumbLd(lang, [{ name: t.catalog.title, path: "/books" }, { name: p.title, path: `/books/${p.slug}` }]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href={`/${lang}/books`} className="inline-flex min-h-11 items-center text-ink-soft hover:text-plum-900">{t.product.back}</Link>
      <ProductBuy lang={lang} product={{ id: p.id, title: p.title }} t={{ product: productStrings, formats: t.formats, bookLocales: t.bookLocales }}
        covers={p.coverByLocale} comingSoon={{ title: price.text, note: t.product.comingSoonNote }}
        specs={{ rows: specs, t: specStrings }}
        variants={p.variants.map((v) => ({ id: v.id, bookLocale: v.book_locale, format: v.format, priceMinor: v.price_minor, stock: v.stock, sellable: v.sellable, restockNote: v.restock_note }))}>
        <h1 className="text-4xl text-plum-900 sm:text-5xl" lang={p.translationConfirmed ? undefined : "uk"}>{p.title}</h1>
        {!p.translationConfirmed && t.product.originalTitleNote && <p className="mt-2 text-sm text-ink-soft">{t.product.originalTitleNote}</p>}
        {p.description
          ? <div className="prose-soft mt-6 max-w-[62ch] text-ink-soft">{p.description.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}</div>
          : <p className="mt-6 max-w-[62ch] text-ink-soft">{t.seriesBlurb}</p>}
      </ProductBuy>
      {p.spreads.length > 0 && (
        <section aria-labelledby="inside-h" className="mt-16">
          <h2 id="inside-h" className="text-3xl text-plum-900 sm:text-4xl" data-reveal="left">{t.home.insideTitle}</h2>
          <Spreads items={p.spreads} hint={t.home.insideHint} close={t.home.close} />
        </section>
      )}
      <JsonLd nodes={[bookLd, crumbs]} />
      {sellable.length > 0 && <Track event="ViewContent" params={{ content_ids: [p.id], content_name: p.title, content_type: "product", value: Math.min(...sellable.map((v) => v.price_minor!)) / 100, currency: "UAH" }} />}
    </div>
  );
}
