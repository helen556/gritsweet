import "server-only";

/**
 * Стан інтеграцій береться ЛИШЕ з серверних змінних середовища.
 * Відсутній ключ = інтеграція чесно вимкнена, сайт працює далі.
 */
const isProd = () => process.env.NODE_ENV === "production";

/** Режими: disabled | manual_link | mono_acquiring | provider (лише тестовий провайдер для розробки). */
export type PaymentMode = "disabled" | "manual_link" | "mono_acquiring" | "provider";
export const PAYMENT_MODES: PaymentMode[] = ["disabled", "manual_link", "mono_acquiring", "provider"];

export function paymentConfig() {
  const raw = (process.env.PAYMENT_MODE ?? "") as PaymentMode;
  const envMode: PaymentMode | "" = PAYMENT_MODES.includes(raw) ? raw : "";
  const provider = process.env.PAYMENT_PROVIDER ?? "";
  const secret = process.env.PAYMENT_WEBHOOK_SECRET ?? "";
  // Тестовий провайдер ніколи не працює в production.
  const testReady = provider === "test" && !!secret && !isProd();
  const monoToken = process.env.MONOBANK_TOKEN ?? "";
  return { envMode, provider, secret, testReady, monoToken, mode: envMode || "disabled", providerReady: envMode === "provider" && testReady };
}

export function emailConfig() {
  const provider = process.env.EMAIL_PROVIDER ?? "none";
  if (provider === "resend" && process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
    return { provider: "resend" as const, from: process.env.EMAIL_FROM, apiKey: process.env.RESEND_API_KEY };
  // "outbox" — лише для локальної розробки: листи пишуться у файли storage/outbox
  if (provider === "outbox" && !isProd()) return { provider: "outbox" as const, from: "dev@localhost" };
  return { provider: "none" as const };
}

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const novaPoshtaKey = () => process.env.NOVA_POSHTA_API_KEY ?? "";
export const downloadTtlHours = () => Math.min(Math.max(Number(process.env.DOWNLOAD_LINK_TTL_HOURS ?? 72) || 72, 1), 24 * 30);
export const downloadMax = () => Math.min(Math.max(Number(process.env.DOWNLOAD_MAX_COUNT ?? 5) || 5, 1), 50);
