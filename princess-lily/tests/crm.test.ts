import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import ExcelJS from "exceljs";
import { generateKeyPairSync, createSign } from "node:crypto";
import { db } from "@/db";
import { resetDb, baseCheckout } from "./helpers";
import { createOrder } from "@/lib/orders";
import { markPaid } from "@/lib/fulfillment";
import { listOrders, parseFilters, kyiv, kyivDayStartUtc } from "@/lib/crm";
import { ordersToXlsx, ordersToPdf, safeCell } from "@/lib/export";
import { saveReceipt, sniffReceipt } from "@/lib/receipts";
import { privateStorage } from "@/lib/storage";
import { notifyNewOrder, notifyPaid, retryDueNotifications, telegramConfigured } from "@/lib/telegram";
import { verifyMonoSignature } from "@/lib/payments/monobank";
import * as email from "@/lib/email";

const print = (over: Record<string, unknown> = {}) => baseCheckout({ lines: [{ variantId: "v_print", quantity: 1 }], phone: "+380501234567", npCity: "Київ", npPoint: "Відділення №5", ...over });

beforeEach(async () => { await resetDb(); vi.restoreAllMocks(); vi.spyOn(email, "sendEmail").mockResolvedValue({ ok: true, id: "m" }); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("CRM table", () => {
  it("new order is visible with correct Kyiv time, names and kind; sorting and filters work", async () => {
    const a = await createOrder(baseCheckout({ firstName: "Анна", lastName: "Коваль" }));
    const b = await createOrder(print({ firstName: "Богдан", lastName: "Мельник", recipient: { firstName: "Ірина", lastName: "Мельник", phone: "+380671112233" } }));
    const c = await createOrder(baseCheckout({ lines: [{ variantId: "v_pdf", quantity: 1 }, { variantId: "v_print", quantity: 2 }], phone: "+380501234567", npCity: "Львів", npPoint: "Поштомат 1", firstName: "Віра", lastName: "Іваненко" }));
    if (!a.ok || !b.ok || !c.ok) throw new Error("create");
    // фіксуємо час: 2026-10-09 21:30 UTC = 10.10.2026 00:30 за Києвом (EEST, +3)
    await db.updateTable("orders").set({ created_at: "2026-10-09T21:30:00.000Z" }).where("id", "=", a.orderId).execute();
    await db.updateTable("orders").set({ created_at: "2026-10-08T09:00:00.000Z" }).where("id", "=", b.orderId).execute();
    await db.updateTable("orders").set({ created_at: "2026-10-09T10:00:00.000Z" }).where("id", "=", c.orderId).execute();
    const all = await listOrders(parseFilters({}));
    expect(all.total).toBe(3);
    expect(all.rows.map((r) => r.id)).toEqual([a.orderId, c.orderId, b.orderId]); // за датою, новіші зверху
    const ra = all.rows.find((r) => r.id === a.orderId)!;
    expect(kyiv(ra.created_at)).toContain("10.10.2026");
    expect(kyiv(ra.created_at)).toContain("00:30");
    expect(ra.kind).toBe("pdf");
    expect(all.rows.find((r) => r.id === b.orderId)!.recipient).toBe("Ірина Мельник");
    expect(all.rows.find((r) => r.id === c.orderId)!.kind).toBe("mixed");
    // сортування за сумою
    const bySum = await listOrders(parseFilters({ sort: "total_minor", dir: "asc" }));
    expect(bySum.rows[0].total_minor).toBeLessThanOrEqual(bySum.rows[2].total_minor);
    // фільтри: період за Києвом (10.10 включає замовлення a, створене 09.10 за UTC)
    expect((await listOrders(parseFilters({ from: "2026-10-10", to: "2026-10-10" }))).rows.map((r) => r.id)).toEqual([a.orderId]);
    expect((await listOrders(parseFilters({ kind: "mixed" }))).rows.map((r) => r.id)).toEqual([c.orderId]);
    expect((await listOrders(parseFilters({ kind: "print" }))).rows.map((r) => r.id)).toEqual([b.orderId]);
    expect((await listOrders(parseFilters({ shipping: "none" }))).rows.map((r) => r.id)).toEqual([a.orderId]);
    expect((await listOrders(parseFilters({ q: "мельник" }))).rows.map((r) => r.id)).toEqual([b.orderId]);
    await markPaid(b.orderId, { source: "admin:t", checkedBy: "owner@example.com" });
    expect((await listOrders(parseFilters({ payment: "paid" }))).rows.map((r) => r.id)).toEqual([b.orderId]);
    expect((await listOrders(parseFilters({ shipping: "to_ship" }))).rows.map((r) => r.id)).toEqual([b.orderId]);
    // пагінація
    const p2 = await listOrders({ ...parseFilters({ size: "25" }), pageSize: 2, page: 2 });
    expect(p2.rows).toHaveLength(1);
  });
  it("Kyiv day start handles DST", () => {
    expect(kyivDayStartUtc("2026-10-10")).toBe("2026-10-09T21:00:00.000Z"); // літній час +3
    expect(kyivDayStartUtc("2026-12-01")).toBe("2026-11-30T22:00:00.000Z"); // зимовий +2
  });
  it("timeline records status changes with actor", async () => {
    const r = await createOrder(baseCheckout()); if (!r.ok) throw new Error();
    await markPaid(r.orderId, { source: "admin:x", checkedBy: "owner@example.com" });
    const ev = await db.selectFrom("order_events").selectAll().where("order_id", "=", r.orderId).orderBy("created_at").execute();
    expect(ev.some((e) => e.kind === "payment" && e.to_status === "paid" && e.actor === "owner@example.com")).toBe(true);
    expect(ev.some((e) => e.kind === "order" && e.to_status === "processing")).toBe(true);
    const o = await db.selectFrom("orders").select(["payment_checked_by", "order_status"]).where("id", "=", r.orderId).executeTakeFirstOrThrow();
    expect(o).toEqual({ payment_checked_by: "owner@example.com", order_status: "processing" });
  });
});

describe("exports", () => {
  it("xlsx reproduces filtered orders with Ukrainian headers, Kyiv time, sums; formulas neutralised", async () => {
    const r = await createOrder(baseCheckout({ firstName: "=HYPERLINK(\"http://x\")", lastName: "Тест" })); if (!r.ok) throw new Error();
    await createOrder(print());
    const { rows, sum } = await listOrders(parseFilters({ kind: "pdf" }), { all: true });
    const buf = await ordersToXlsx(rows, { title: "Замовлення", sum });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Замовлення")!;
    expect(ws.getRow(2).getCell(1).value).toBe("Номер");
    expect(ws.getRow(2).getCell(2).value).toBe("Створено (Київ)");
    expect(ws.rowCount).toBe(4); // заголовок, шапка, 1 рядок PDF-замовлення, підсумок
    const buyer = String(ws.getRow(3).getCell(3).value);
    expect(buyer.startsWith("'=")).toBe(true);
    expect(ws.getRow(3).getCell(3).formula).toBeUndefined();
    expect(ws.getRow(3).getCell(9).value).toBe(250);
    expect(ws.getRow(4).getCell(9).value).toBe(250);
    expect(JSON.stringify(ws.getSheetValues())).not.toMatch(/pdf\/test\.pdf|access_token|whsec/);
  });
  it("pdf export renders a multi-page table with Cyrillic and totals", async () => {
    for (let i = 0; i < 30; i++) await createOrder(baseCheckout({ firstName: `Покупець${i}`, lastName: "Тестовий" }));
    const { rows, sum } = await listOrders(parseFilters({}), { all: true });
    const pdf = await ordersToPdf(rows, { title: "Замовлення за період", sum });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const pages = (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;
    expect(pages).toBeGreaterThan(1);
  });
  it("safeCell", () => {
    expect(safeCell("=1+1")).toBe("'=1+1");
    expect(safeCell("+380")).toBe("'+380");
    expect(safeCell("Олена")).toBe("Олена");
  });
});

describe("receipts", () => {
  it("stores only real image/PDF files privately, with limits and event", async () => {
    const r = await createOrder(baseCheckout()); if (!r.ok) throw new Error();
    expect(sniffReceipt(Buffer.from("<html>"))).toBeNull();
    expect((await saveReceipt(r.orderId, Buffer.from("<script>alert(1)</script>"), "x.pdf", "покупець", 1000)).ok).toBe(false);
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100)]);
    const ok = await saveReceipt(r.orderId, png, "квитанція.png", "покупець", 5_000_000);
    expect(ok.ok).toBe(true);
    const rec = await db.selectFrom("receipts").selectAll().executeTakeFirstOrThrow();
    expect(rec.storage_key.startsWith("receipts/")).toBe(true);
    expect(rec.storage_key).not.toContain("public");
    expect(await privateStorage().get(rec.storage_key)).not.toBeNull();
    expect((await saveReceipt(r.orderId, Buffer.alloc(6_000_000, 0xff), "big.jpg", "покупець", 5_000_000)).ok).toBe(false);
    const ev = await db.selectFrom("order_events").selectAll().where("kind", "=", "receipt").execute();
    expect(ev).toHaveLength(1);
  });
});

describe("telegram", () => {
  it("without token: checkout succeeds, notification stored as not_configured", async () => {
    expect(telegramConfigured()).toBe(false);
    const r = await createOrder(baseCheckout()); if (!r.ok) throw new Error();
    await notifyNewOrder(r.orderId);
    const n = await db.selectFrom("notifications").selectAll().executeTakeFirstOrThrow();
    expect(n.status).toBe("not_configured");
  });
  it("sends once, retries after failure, never duplicates; paid notice only after verified payment", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:TEST");
    vi.stubEnv("TELEGRAM_CHAT_ID", "42");
    const calls: string[] = [];
    let fail = true;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push(String(JSON.parse(String(init.body)).text));
      expect(url).toBe("https://api.telegram.org/bot123:TEST/sendMessage");
      if (fail) { fail = false; return new Response(JSON.stringify({ ok: false, error_code: 502, description: "Bad Gateway" }), { status: 502 }); }
      return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
    }));
    const r = await createOrder(baseCheckout({ firstName: "Олена", lastName: "Т" })); if (!r.ok) throw new Error();
    await notifyNewOrder(r.orderId);
    let n = await db.selectFrom("notifications").selectAll().executeTakeFirstOrThrow();
    expect(n.status).toBe("failed");
    expect(n.next_attempt_at).not.toBeNull();
    await notifyNewOrder(r.orderId); // повторний виклик (напр. повтор запиту) — та сама dedupe_key
    await db.updateTable("notifications").set({ next_attempt_at: new Date(Date.now() - 1).toISOString() }).execute();
    await retryDueNotifications();
    await retryDueNotifications();
    n = await db.selectFrom("notifications").selectAll().executeTakeFirstOrThrow();
    expect(n.status).toBe("sent");
    expect(await db.selectFrom("notifications").selectAll().execute()).toHaveLength(1);
    const delivered = calls.filter((c) => c.includes("Нове замовлення"));
    expect(delivered.length).toBe(2); // 1 невдала + 1 успішний повтор після backoff; повторний виклик і зайві retry не надсилають
    expect(calls.at(-1)).toContain("очікує оплату (НЕ підтверджено)");
    // «оплачено» не надсилається для неоплаченого
    await notifyPaid(r.orderId, "x");
    expect(calls.some((c) => c.includes("Оплату підтверджено"))).toBe(false);
    await markPaid(r.orderId, { source: "admin:x", checkedBy: "owner@example.com" });
    expect(calls.filter((c) => c.includes("Оплату підтверджено"))).toHaveLength(1);
    await notifyPaid(r.orderId, "x"); // повтор — без дубля
    expect(calls.filter((c) => c.includes("Оплату підтверджено"))).toHaveLength(1);
  });
});

describe("monobank webhook signature", () => {
  it("accepts a valid ECDSA X-Sign and rejects tampered body", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const body = JSON.stringify({ invoiceId: "inv1", status: "success", amount: 25000, ccy: 980, reference: "ord_x" });
    const s = createSign("SHA256"); s.update(body); s.end();
    const sig = s.sign(privateKey).toString("base64");
    expect(verifyMonoSignature(body, sig, pem)).toBe(true);
    expect(verifyMonoSignature(body.replace("25000", "1"), sig, pem)).toBe(false);
    expect(verifyMonoSignature(body, "AAAA", pem)).toBe(false);
  });
});
