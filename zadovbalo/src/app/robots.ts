import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // API та майбутні приватні маршрути взаємодії не індексуються.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/dev/"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
