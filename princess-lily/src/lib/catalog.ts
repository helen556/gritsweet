import "server-only";
import { db } from "@/db";
import type { Locale, Product, ProductVariant } from "@/db/types";
import { sellability } from "./catalog-rules";

export type CatalogVariant = ProductVariant & { sellable: boolean; reason: string | null };
export type CatalogProduct = Product & {
  title: string; description: string; coverAlt: string; translationConfirmed: boolean;
  widths: number[]; variants: CatalogVariant[];
};

async function hydrate(products: Product[], locale: Locale): Promise<CatalogProduct[]> {
  if (!products.length) return [];
  const ids = products.map((p) => p.id);
  const [trs, vars] = await Promise.all([
    db.selectFrom("product_translations").selectAll().where("product_id", "in", ids).execute(),
    db.selectFrom("product_variants").selectAll().where("product_id", "in", ids).orderBy("book_locale").orderBy("format").execute(),
  ]);
  return products.map((p) => {
    const tr = trs.find((t) => t.product_id === p.id && t.locale === locale) ?? trs.find((t) => t.product_id === p.id && t.locale === "uk");
    return {
      ...p,
      title: tr?.title ?? p.slug,
      description: tr?.locale === locale ? tr.description : "",
      coverAlt: tr?.cover_alt ?? "",
      translationConfirmed: tr?.locale === locale && !!tr.is_confirmed,
      widths: JSON.parse(p.cover_widths) as number[],
      variants: vars.filter((v) => v.product_id === p.id).map((v) => {
        const s = sellability({ productStatus: p.status, isActive: v.is_active, priceMinor: v.price_minor, format: v.format, stock: v.stock, privatePdfKey: v.private_pdf_key });
        return { ...v, sellable: s.ok, reason: s.ok ? null : s.reason };
      }),
    };
  });
}

/** Вітрина: лише опубліковані та «незабаром». Чернетки не показуються. */
export async function listPublicProducts(locale: Locale) {
  const ps = await db.selectFrom("products").selectAll().where("status", "in", ["published", "coming_soon"]).orderBy("sort_order").orderBy("created_at").execute();
  return hydrate(ps, locale);
}
export async function getPublicProduct(slug: string, locale: Locale) {
  const p = await db.selectFrom("products").selectAll().where("slug", "=", slug).where("status", "in", ["published", "coming_soon"]).executeTakeFirst();
  return p ? (await hydrate([p], locale))[0] : null;
}
export async function getProductForAdmin(id: string) {
  const p = await db.selectFrom("products").selectAll().where("id", "=", id).executeTakeFirst();
  if (!p) return null;
  const [trs] = await Promise.all([db.selectFrom("product_translations").selectAll().where("product_id", "=", id).execute()]);
  return { ...(await hydrate([p], "uk"))[0], translations: trs };
}
