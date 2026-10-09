import "server-only";
import { createVerify } from "node:crypto";
import { db } from "@/db";
import type { PaymentAdapter, VerifiedNotification } from "./providers";

/**
 * monobank еквайринг (рахунок на кожне замовлення). Потрібні підключений еквайринг і токен мерчанта власниці (MONOBANK_TOKEN).
 *
 * ⚠️ НЕ ПЕРЕВІРЕНО НАЖИВО: у середовищі розробки доступ до api.monobank.ua і документації заблоковано мережевою політикою.
 * Реалізовано за публічною документацією (https://monobank.ua/api-docs/acquiring/...):
 *   POST /api/merchant/invoice/create  (X-Token) {amount, ccy:980, merchantPaymInfo{reference,destination}, redirectUrl, webHookUrl, validity} → {invoiceId, pageUrl}
 *   Вебхук: тіло JSON {invoiceId, status, amount, ccy, reference, modifiedDate, ...}, заголовок X-Sign = base64(ECDSA-SHA256 підпис тіла),
 *   відкритий ключ: GET /api/merchant/pubkey (X-Token) → {key: base64(PEM)}.
 *   Перед зарахуванням — додаткова перевірка GET /api/merchant/invoice/status?invoiceId=…
 * Перед увімкненням режиму mono_acquiring звірте поля з актуальною документацією й проведіть тестовий платіж.
 */
const API = "https://api.monobank.ua";
const token = () => process.env.MONOBANK_TOKEN ?? "";

let pubKeyCache: { pem: string; at: number } | null = null;
async function pubKey(force = false): Promise<string | null> {
  if (!force && pubKeyCache && Date.now() - pubKeyCache.at < 6 * 3600_000) return pubKeyCache.pem;
  const r = await fetch(`${API}/api/merchant/pubkey`, { headers: { "X-Token": token() }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!r?.ok) return null;
  const j = (await r.json()) as { key?: string };
  if (!j.key) return null;
  pubKeyCache = { pem: Buffer.from(j.key, "base64").toString("utf8"), at: Date.now() };
  return pubKeyCache.pem;
}

export function verifyMonoSignature(rawBody: string, xSign: string, pem: string): boolean {
  try {
    const v = createVerify("SHA256");
    v.update(rawBody);
    v.end();
    return v.verify(pem, Buffer.from(xSign, "base64"));
  } catch { return false; }
}

const MAP: Record<string, VerifiedNotification["status"]> = { success: "success", failure: "failure", expired: "failure", reversed: "failure" };

export const monoAdapter: PaymentAdapter = {
  id: "mono",
  async createCheckout(req) {
    const r = await fetch(`${API}/api/merchant/invoice/create`, {
      method: "POST",
      headers: { "X-Token": token(), "content-type": "application/json" },
      body: JSON.stringify({
        amount: req.amountMinor, ccy: 980,
        merchantPaymInfo: { reference: req.orderId, destination: req.description },
        redirectUrl: req.returnUrl,
        webHookUrl: `${(process.env.APP_URL ?? "").replace(/\/$/, "")}/api/payments/webhook/mono`,
        validity: 24 * 3600,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const j = (await r.json().catch(() => ({}))) as { invoiceId?: string; pageUrl?: string; errText?: string };
    if (!r.ok || !j.invoiceId || !j.pageUrl) throw new Error(`monobank invoice: ${r.status} ${j.errText ?? ""}`.slice(0, 200));
    return { redirectUrl: j.pageUrl, reference: j.invoiceId };
  },
  async parseWebhook(rawBody, headers) {
    const sign = headers.get("x-sign") ?? "";
    if (!sign) return null;
    let pem = await pubKey();
    if (!pem) return null;
    let ok = verifyMonoSignature(rawBody, sign, pem);
    if (!ok) { pem = await pubKey(true); ok = !!pem && verifyMonoSignature(rawBody, sign, pem); } // ротація ключа
    if (!ok) return null;
    try {
      const j = JSON.parse(rawBody) as { invoiceId?: string; status?: string; amount?: number; ccy?: number; reference?: string; modifiedDate?: string };
      if (!j.invoiceId || !j.status || !Number.isSafeInteger(j.amount)) return null;
      // order_id: reference рахунку; запасний шлях — пошук за invoiceId
      let orderId = j.reference ?? "";
      if (!orderId) orderId = (await db.selectFrom("orders").select("id").where("payment_reference", "=", j.invoiceId).executeTakeFirst())?.id ?? "";
      return {
        provider: "mono", eventId: `${j.invoiceId}:${j.status}:${j.modifiedDate ?? ""}`, orderId, paymentId: j.invoiceId,
        amountMinor: j.amount!, currency: j.ccy === 980 ? "UAH" : String(j.ccy ?? ""), status: MAP[j.status] ?? "pending",
      };
    } catch { return null; }
  },
  async confirmWithProvider(n) {
    if (!n.paymentId) return false;
    const r = await fetch(`${API}/api/merchant/invoice/status?invoiceId=${encodeURIComponent(n.paymentId)}`, { headers: { "X-Token": token() }, signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!r?.ok) return false;
    const j = (await r.json()) as { status?: string; amount?: number; ccy?: number };
    return j.status === "success" && j.amount === n.amountMinor && j.ccy === 980;
  },
};
