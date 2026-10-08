import Script from "next/script";

/**
 * Базова аналітика без персональних даних через налаштовуваний провайдер.
 * Зараз підтримано Plausible (cookie-less). Без змінних середовища нічого не завантажується.
 */
export default function Analytics() {
  const provider = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER;
  const domain = process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN;
  if (provider !== "plausible" || !domain) return null;
  const src = process.env.NEXT_PUBLIC_ANALYTICS_SRC || "https://plausible.io/js/script.js";
  return <Script defer data-domain={domain} src={src} strategy="afterInteractive" />;
}
