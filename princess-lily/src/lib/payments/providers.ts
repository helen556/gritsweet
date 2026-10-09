import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { paymentConfig, appUrl } from "../config";
import { monoAdapter } from "./monobank";

/** Перевірене (підписане) повідомлення від платіжного провайдера. */
export type VerifiedNotification = {
  provider: string;
  eventId: string;
  orderId: string;
  /** ID платежу/рахунку у провайдера (для CRM) */
  paymentId?: string;
  amountMinor: number;
  currency: string;
  status: "success" | "failure" | "pending";
};
export type CheckoutRequest = { orderId: string; orderNumber: string; amountMinor: number; currency: string; description: string; returnUrl: string };

/**
 * Інтерфейс адаптера. Щоб підключити реального провайдера (LiqPay, WayForPay, monobank тощо),
 * реалізуйте createCheckout (створення платежу через API) і parseWebhook (перевірка підпису!)
 * та зареєструйте адаптер у `adapters` нижче.
 */
export interface PaymentAdapter {
  id: string;
  /** Додаткова серверна перевірка платежу у провайдера перед зарахуванням (якщо API це дозволяє). */
  confirmWithProvider?(n: VerifiedNotification): Promise<boolean>;
  createCheckout(req: CheckoutRequest): Promise<{ redirectUrl: string; reference: string }>;
  /** null — підпис невірний або тіло пошкоджене. */
  parseWebhook(rawBody: string, headers: Headers): Promise<VerifiedNotification | null>;
}

export const hmacHex = (secret: string, body: string) => createHmac("sha256", secret).update(body).digest("hex");
export function safeEqualHex(a: string, b: string) {
  if (!/^[0-9a-f]+$/i.test(a) || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/**
 * ТЕСТОВИЙ провайдер — лише для розробки й автотестів (у production вимкнений у config.ts).
 * Вебхук: тіло JSON {event_id, order_id, amount_minor, currency, status}, заголовок x-signature = HMAC-SHA256(secret, body).
 */
const testAdapter: PaymentAdapter = {
  id: "test",
  async createCheckout(req) {
    return { redirectUrl: `${appUrl()}/api/payments/test-checkout?order=${encodeURIComponent(req.orderId)}&return=${encodeURIComponent(req.returnUrl)}`, reference: `test-${req.orderNumber}` };
  },
  async parseWebhook(rawBody, headers) {
    const { secret } = paymentConfig();
    const sig = headers.get("x-signature") ?? "";
    if (!secret || !safeEqualHex(sig, hmacHex(secret, rawBody))) return null;
    try {
      const j = JSON.parse(rawBody);
      if (typeof j.event_id !== "string" || typeof j.order_id !== "string" || !Number.isSafeInteger(j.amount_minor) || typeof j.currency !== "string") return null;
      const status = j.status === "success" ? "success" : j.status === "failure" ? "failure" : "pending";
      return { provider: "test", eventId: j.event_id, orderId: j.order_id, amountMinor: j.amount_minor, currency: j.currency, status };
    } catch { return null; }
  },
};


/** Адаптер, доступний для вебхуків/оплати (залежить лише від серверних ключів). */
export function adapterById(id: string): PaymentAdapter | null {
  const cfg = paymentConfig();
  if (id === "test") return cfg.testReady ? testAdapter : null;
  if (id === "mono") return cfg.monoToken ? monoAdapter : null;
  return null;
}
