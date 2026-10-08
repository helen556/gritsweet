import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/uk/checkout", "/en/checkout", "/uk/order/", "/en/order/", "/uk/cart", "/en/cart"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
