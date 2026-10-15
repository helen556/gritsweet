export const dynamic = "force-dynamic";
import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

/**
 * Приватне (адмінка, API, сторінки замовлень за секретним посиланням) — Disallow + noindex у відповіді.
 * Публічні службові сторінки (кошик, оформлення, чернетки документів) НЕ блокуються тут, щоб Google бачив їхній noindex.
 * CSS/JS (/_next/), зображення й відео (/media/, /uploads/) відкриті.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/uk/order/", "/en/order/"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
