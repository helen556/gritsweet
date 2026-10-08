import type { Metadata } from "next";

export const siteUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** title/description + canonical + hreflang uk/en для сторінки за шляхом без префікса мови. */
export function pageMeta(lang: "uk" | "en", path: string, title: string, description: string, opts: { noindex?: boolean; image?: string } = {}): Metadata {
  const p = path === "/" ? "" : path;
  return {
    title, description,
    alternates: { canonical: `/${lang}${p}`, languages: { uk: `/uk${p}`, en: `/en${p}`, "x-default": `/uk${p}` } },
    openGraph: {
      title, description, url: `/${lang}${p}`, siteName: lang === "uk" ? "Історії принцеси Лілі" : "Princess Lily Stories",
      locale: lang === "uk" ? "uk_UA" : "en_US", type: "website",
      images: [{ url: opts.image ?? "/media/og-cover.jpg", width: 1200, height: 630 }],
    },
    robots: opts.noindex ? { index: false, follow: false } : undefined,
  };
}
