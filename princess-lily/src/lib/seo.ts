import type { Metadata } from "next";
import { getDict } from "@/i18n";

export const siteUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Код підтвердження Google Search Console (публічний, не секрет). Можна перевизначити змінною середовища. */
export const googleSiteVerification = () => process.env.GOOGLE_SITE_VERIFICATION || "pjt_6G5JiwtLByf8DZpvJeG6ambFe_spIaA_n2iZtsw";

const OG_IMAGE = { url: "/media/og-cover.jpg", width: 1200, height: 630 };

/** hreflang для пари сторінок uk/en; x-default — українська версія. */
export function hreflang(p: string) {
  return { "uk-UA": `/uk${p}`, en: `/en${p}`, "x-default": `/uk${p}` };
}

/** title/description + canonical + hreflang uk-UA/en + Open Graph + Twitter Card для сторінки за шляхом без префікса мови. */
export function pageMeta(lang: "uk" | "en", path: string, title: string, description: string, opts: { noindex?: boolean; image?: string; imageAlt?: string } = {}): Metadata {
  const p = path === "/" ? "" : path;
  const t = getDict(lang);
  const image = opts.image ? { url: opts.image, alt: opts.imageAlt ?? title } : { ...OG_IMAGE, alt: t.seo.ogAlt };
  return {
    title, description,
    alternates: { canonical: `/${lang}${p}`, languages: hreflang(p) },
    openGraph: {
      title, description, url: `/${lang}${p}`, siteName: t.meta.siteName,
      locale: lang === "uk" ? "uk_UA" : "en_US", alternateLocale: lang === "uk" ? ["en_US"] : ["uk_UA"], type: "website",
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    robots: opts.noindex ? { index: false, follow: false } : undefined,
  };
}

// ---------- Структуровані дані (JSON-LD) ----------

export const orgId = () => `${siteUrl()}/#organization`;

/** Організація-магазин (бренд серії); без вигаданих контактів — лише те, що заповнено в адмінці. */
export function organizationLd(lang: "uk" | "en", sameAs: string[] = [], email?: string) {
  const t = getDict(lang);
  return {
    "@type": "Organization", "@id": orgId(), name: t.meta.siteName, alternateName: getDict(lang === "uk" ? "en" : "uk").meta.siteName,
    url: siteUrl(), logo: `${siteUrl()}/media/lily-portrait-640.webp`, image: `${siteUrl()}/media/og-cover.jpg`, description: t.seo.orgDescription,
    ...(email ? { email } : {}), ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteLd(lang: "uk" | "en") {
  const t = getDict(lang);
  return { "@type": "WebSite", "@id": `${siteUrl()}/#website`, url: siteUrl(), name: t.meta.siteName, inLanguage: lang === "uk" ? "uk-UA" : "en", publisher: { "@id": orgId() } };
}

/** Хлібні крихти: Головна › … ; останній пункт — поточна сторінка. */
export function breadcrumbLd(lang: "uk" | "en", items: { name: string; path: string }[]) {
  const t = getDict(lang);
  const all = [{ name: t.seo.breadcrumbHome, path: "" }, ...items];
  return {
    "@type": "BreadcrumbList",
    itemListElement: all.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${siteUrl()}/${lang}${it.path}` })),
  };
}

/** Серіалізація для <script type="application/ld+json"> (безпечна для HTML). */
export function ldJson(...nodes: (object | null | undefined)[]) {
  const graph = nodes.filter(Boolean);
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
}
