export const dynamic = "force-dynamic";
import type { MetadataRoute } from "next";
import { db } from "@/db";
import { siteUrl, w3cDate } from "@/lib/seo";

/** Лише публічні сторінки (uk + en з hreflang); без адмінки, кошика, оформлення, замовлень, завантажень і чернеток документів. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const pages = ["", "/books", "/about", "/delivery", "/returns", "/contacts"];
  // без бази карта все одно віддається (статичні сторінки), щоб Google не отримав помилку
  const products = await db.selectFrom("products").select(["slug", "updated_at"]).where("status", "in", ["published", "coming_soon"]).execute()
    .catch((e) => { console.error("[sitemap] products:", e); return [] as { slug: string; updated_at: unknown }[]; });
  const entry = (p: string, lastModified?: Date): MetadataRoute.Sitemap[number] => ({
    url: `${base}/uk${p}`, lastModified,
    alternates: { languages: { "uk-UA": `${base}/uk${p}`, en: `${base}/en${p}`, "x-default": `${base}/uk${p}` } },
  });
  return [...pages.map((p) => entry(p)), ...products.map((p) => entry(`/books/${p.slug}`, w3cDate(p.updated_at)))].flatMap((e) => [
    e, { ...e, url: e.url.replace(`${base}/uk`, `${base}/en`) },
  ]);
}

