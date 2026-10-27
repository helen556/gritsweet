import type { NextConfig } from "next";
import { POTTY_OLD_SLUGS, POTTY_SLUG } from "./src/content/books";

const nextConfig: NextConfig = {
  // окремий застосунок у підтеці репозиторію
  turbopack: { root: import.meta.dirname },
  poweredByHeader: false,
  serverExternalPackages: ["better-sqlite3", "sharp", "pdfkit", "exceljs"],
  // шрифт для PDF-експорту потрапляє в серверну збірку (Vercel file tracing)
  outputFileTracingIncludes: { "/admin/orders-export": ["./assets-fonts/**/*"] },
  experimental: {
    globalNotFound: true,
    // CSS невеликий (Tailwind) — вбудовуємо в HTML, щоб не блокувати перше малювання
    inlineCss: true,
  },
  // Постійні 301 зі старих адрес книжки про горщик (назву змінено 27.10.2026). Адреси, змінені пізніше
  // в адмінці, переадресовує сама сторінка книжки (таблиця slug_redirects).
  async redirects() {
    return ["uk", "en"].flatMap((lang) => POTTY_OLD_SLUGS.map((old) => ({
      source: `/${lang}/books/${old}`, destination: `/${lang}/books/${POTTY_SLUG}`, statusCode: 301 as const,
    })));
  },
  async headers() {
    return [
      // Оптимізовані зображення та відео: стабільні імена, довгий кеш
      { source: "/media/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }] },
    ];
  },
};

export default nextConfig;
