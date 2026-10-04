import type { MetadataRoute } from "next";
import { siteUrl } from "@/content/dictionaries";

export default function sitemap(): MetadataRoute.Sitemap {
  const languages = { uk: `${siteUrl}/`, en: `${siteUrl}/en` };
  return [
    { url: `${siteUrl}/`, changeFrequency: "monthly", priority: 1, alternates: { languages } },
    { url: `${siteUrl}/en`, changeFrequency: "monthly", priority: 0.8, alternates: { languages } },
  ];
}
