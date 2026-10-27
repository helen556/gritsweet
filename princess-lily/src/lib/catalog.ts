import "server-only";
import { db } from "@/db";
import type { Locale, Product, ProductVariant } from "@/db/types";
import { sellability } from "./catalog-rules";

export type CatalogVariant = ProductVariant & { sellable: boolean; reason: string | null };
export type Cover = { base: string; widths: number[]; width: number; height: number; alt: string };
export type Spread = { id: string; base: string; widths: number[]; width: number; height: number; alt: string; locale: Locale | null };
export type CatalogProduct = Product & {
  title: string; description: string; coverAlt: string; translationConfirmed: boolean;
  widths: number[]; variants: CatalogVariant[];
  /** Обкладинка для мови сайту (або загальна) */
  cover: Cover | null;
  /** Обкладинка кожної мовної версії книжки — для перемикача UA/EN */
  coverByLocale: Record<Locale, Cover | null>;
  spreads: Spread[];
};

const parseWidths = (s: string | null) => { try { return (JSON.parse(s ?? "[]") as number[]).filter((n) => Number.isFinite(n)); } catch { return []; } };

async function hydrate(products: Product[], locale: Locale): Promise<CatalogProduct[]> {
  if (!products.length) return [];
  const ids = products.map((p) => p.id);
  const [trs, vars, imgs] = await Promise.all([
    db.selectFrom("product_translations").selectAll().where("product_id", "in", ids).execute(),
    db.selectFrom("product_variants").selectAll().where("product_id", "in", ids).orderBy("book_locale").orderBy("format").execute(),
    db.selectFrom("product_images").selectAll().where("product_id", "in", ids).orderBy("sort_order").orderBy("created_at").execute(),
  ]);
  return products.map((p) => {
    const tr = trs.find((t) => t.product_id === p.id && t.locale === locale) ?? trs.find((t) => t.product_id === p.id && t.locale === "uk");
    const general: Cover | null = p.cover_base && p.cover_width && p.cover_height
      ? { base: p.cover_base, widths: parseWidths(p.cover_widths), width: p.cover_width, height: p.cover_height, alt: tr?.cover_alt ?? "" } : null;
    const coverOf = (l: Locale): Cover | null => {
      const t = trs.find((x) => x.product_id === p.id && x.locale === l);
      if (t?.cover_base && t.cover_width && t.cover_height) return { base: t.cover_base, widths: parseWidths(t.cover_widths), width: t.cover_width, height: t.cover_height, alt: t.cover_alt || general?.alt || "" };
      // загальна обкладинка — лише для мов, у яких немає власної (не видаємо українську за англійську, якщо є окрема)
      return general;
    };
    const coverByLocale = { uk: coverOf("uk"), en: coverOf("en") };
    return {
      ...p,
      cover: coverByLocale[locale] ?? coverByLocale.uk ?? coverByLocale.en,
      coverByLocale,
      spreads: imgs.filter((i) => i.product_id === p.id && i.kind === "spread" && (!i.locale || i.locale === locale))
        .map((i) => ({ id: i.id, base: i.base, widths: parseWidths(i.widths), width: i.width, height: i.height, alt: locale === "en" ? i.alt_en || i.alt_uk : i.alt_uk || i.alt_en, locale: i.locale })),
      title: tr?.title ?? p.slug,
      description: tr?.locale === locale ? tr.description : "",
      coverAlt: tr?.cover_alt ?? "",
      translationConfirmed: tr?.locale === locale && !!tr.is_confirmed,
      widths: JSON.parse(p.cover_widths) as number[],
      // мова сайту — першою (UA-сайт: спершу українське видання)
      variants: vars.filter((v) => v.product_id === p.id).sort((a, b) => Number(a.book_locale !== locale) - Number(b.book_locale !== locale)).map((v) => {
        const s = sellability({ productStatus: p.status, isActive: v.is_active, priceMinor: v.price_minor, format: v.format, stock: v.stock, privatePdfKey: v.private_pdf_key, manualPdf: true });
        return { ...v, sellable: s.ok, reason: s.ok ? null : s.reason };
      }),
    };
  });
}

/** Вітрина: лише опубліковані та «незабаром». Чернетки не показуються. */
export async function listPublicProducts(locale: Locale) {
  const ps = await db.selectFrom("products").selectAll().where("status", "in", ["published", "coming_soon"]).orderBy("sort_order").orderBy("created_at").execute();
  // без жодної обкладинки книжка не показується (не робимо порожніх карток)
  return (await hydrate(ps, locale)).filter((p) => p.cover);
}
export async function getPublicProduct(slug: string, locale: Locale) {
  const p = await db.selectFrom("products").selectAll().where("slug", "=", slug).where("status", "in", ["published", "coming_soon"]).executeTakeFirst();
  const h = p ? (await hydrate([p], locale))[0] : null;
  return h?.cover ? h : null; // без обкладинки книжка на вітрині не показується
}
/** Нова адреса книжки, якщо `slug` — її попередня адреса (для постійної переадресації). */
export async function redirectedSlug(slug: string) {
  const r = await db.selectFrom("slug_redirects as r").innerJoin("products as p", "p.id", "r.product_id")
    .select("p.slug").where("r.old_slug", "=", slug).where("p.status", "in", ["published", "coming_soon"]).executeTakeFirst();
  return r && r.slug !== slug ? r.slug : null;
}
export async function getProductForAdmin(id: string) {
  const p = await db.selectFrom("products").selectAll().where("id", "=", id).executeTakeFirst();
  if (!p) return null;
  const [trs, images] = await Promise.all([
    db.selectFrom("product_translations").selectAll().where("product_id", "=", id).execute(),
    db.selectFrom("product_images").selectAll().where("product_id", "=", id).orderBy("sort_order").orderBy("created_at").execute(),
  ]);
  return { ...(await hydrate([p], "uk"))[0], translations: trs, images };
}

/** Розвороти всіх книжок на вітрині (для блоку «Книжка зсередини»); порожньо — блок не показується. */
export async function listPublicSpreads(locale: Locale, limit = 8) {
  const rows = await db.selectFrom("product_images as i").innerJoin("products as p", "p.id", "i.product_id")
    .select(["i.id", "i.base", "i.widths", "i.width", "i.height", "i.alt_uk", "i.alt_en", "i.locale", "p.slug"])
    .where("i.kind", "=", "spread").where("p.status", "in", ["published", "coming_soon"])
    .where((eb) => eb.or([eb("i.locale", "is", null), eb("i.locale", "=", locale)]))
    .orderBy("p.sort_order").orderBy("i.sort_order").limit(limit).execute();
  return rows.map((i) => ({ id: i.id, base: i.base, widths: parseWidths(i.widths), width: i.width, height: i.height, alt: locale === "en" ? i.alt_en || i.alt_uk : i.alt_uk || i.alt_en, slug: i.slug }));
}
