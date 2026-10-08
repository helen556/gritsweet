export const dynamic = "force-dynamic";
import type { MetadataRoute } from "next";
import { db } from "@/db";
import { siteUrl } from "@/lib/seo";

/** Лише публічні сторінки; без адмінки, кошика, оформлення, замовлень, завантажень і чернеток документів. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const pages = ["", "/books", "/about", "/delivery", "/returns", "/contacts"];
  const products = await db.selectFrom("products").select(["slug", "updated_at"]).where("status", "in", ["published", "coming_soon"]).execute();
  const entry = (p: string, lastModified?: string): MetadataRoute.Sitemap[number] => ({
    url: `${base}/uk${p}`, lastModified,
    alternates: { languages: { uk: `${base}/uk${p}`, en: `${base}/en${p}` } },
  });
  return [...pages.map((p) => entry(p)), ...products.map((p) => entry(`/books/${p.slug}`, p.updated_at))].flatMap((e) => [
    e, { ...e, url: e.url.replace(`${base}/uk`, `${base}/en`) },
  ]);
}
