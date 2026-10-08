import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // окремий застосунок у підтеці репозиторію
  turbopack: { root: import.meta.dirname },
  poweredByHeader: false,
  serverExternalPackages: ["better-sqlite3", "sharp"],
  experimental: {
    globalNotFound: true,
    // CSS невеликий (Tailwind) — вбудовуємо в HTML, щоб не блокувати перше малювання
    inlineCss: true,
  },
  async headers() {
    return [
      // Оптимізовані зображення та відео: стабільні імена, довгий кеш
      { source: "/media/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }] },
    ];
  },
};

export default nextConfig;
