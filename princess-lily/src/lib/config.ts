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

export type EmailConfig =
  | { provider: "resend"; from: string; apiKey: string }
  | { provider: "smtp"; from: string; host: string; port: number; user: string; pass: string }
  | { provider: "outbox"; from: string }
  | { provider: "none" };

/**
 * Пошта для листів покупцям (лише серверні змінні):
 *   EMAIL_PROVIDER=gmail  + GMAIL_USER, GMAIL_APP_PASSWORD (пароль застосунку Google, не пароль від пошти)
 *   EMAIL_PROVIDER=smtp   + SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
 *   EMAIL_PROVIDER=resend + RESEND_API_KEY, EMAIL_FROM (домен відправника підтверджений у Resend)
 */
export function emailConfig(): EmailConfig {
  const provider = process.env.EMAIL_PROVIDER ?? "none";
  const name = process.env.EMAIL_FROM_NAME || "Історії принцеси Лілі";
  if (provider === "resend" && process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
    return { provider: "resend" as const, from: process.env.EMAIL_FROM, apiKey: process.env.RESEND_API_KEY };
  if (provider === "gmail" && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    const user = process.env.GMAIL_USER.trim();
    return { provider: "smtp" as const, from: `"${name}" <${user}>`, host: "smtp.gmail.com", port: 465, user, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, "") };
  }
  if (provider === "smtp" && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
    return { provider: "smtp" as const, from: process.env.EMAIL_FROM || process.env.SMTP_USER, host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 465, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
  // "outbox" — лише для локальної розробки: листи пишуться у файли storage/outbox
  if (provider === "outbox" && !isProd()) return { provider: "outbox" as const, from: "dev@localhost" };
  return { provider: "none" as const };
}

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const novaPoshtaKey = () => process.env.NOVA_POSHTA_API_KEY ?? "";
export const downloadTtlHours = () => Math.min(Math.max(Number(process.env.DOWNLOAD_LINK_TTL_HOURS ?? 72) || 72, 1), 24 * 30);
export const downloadMax = () => Math.min(Math.max(Number(process.env.DOWNLOAD_MAX_COUNT ?? 5) || 5, 1), 50);
