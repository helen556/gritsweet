import "server-only";

/**
 * Стан інтеграцій береться ЛИШЕ з серверних змінних середовища.
 * Відсутній ключ = інтеграція чесно вимкнена, сайт працює далі.
 */
const isProd = () => process.env.NODE_ENV === "production";

export type PaymentMode = "disabled" | "manual_link" | "provider";

export function paymentConfig() {
  const raw = (process.env.PAYMENT_MODE ?? "disabled") as PaymentMode;
  const mode: PaymentMode = ["disabled", "manual_link", "provider"].includes(raw) ? raw : "disabled";
  const provider = process.env.PAYMENT_PROVIDER ?? "";
  const secret = process.env.PAYMENT_WEBHOOK_SECRET ?? "";
  // Тестовий провайдер ніколи не працює в production.
  const providerReady = mode === "provider" && !!provider && !!secret && !(provider === "test" && isProd());
  return { mode, provider, secret, providerReady };
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
