import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { normCity, purchaseCapiEvent, purchaseEventId, purchaseValue } from "@/lib/meta-capi";

const order = { id: "ord_abc", number: "PL-1", total_minor: 39900, email: "Buyer@Example.com", phone: "+380 50 123 45 67", first_name: "Олена", last_name: "Тестова",
  meta_fbp: "fb.1.1.2", meta_fbc: null, paid_at: "2026-11-23T19:30:33.400Z", site_locale: "uk" };
const items = [{ product_id: "prd_potty", quantity: 1, unit_price_minor: 39900 }];

describe("Meta Purchase: сума, валюта, event_id", () => {
  test("value — фактична сума замовлення в гривнях, currency — UAH", () => {
    const e = purchaseCapiEvent(order, items, "https://lizakidsbooks.com")!;
    expect(e.event_name).toBe("Purchase");
    expect(e.custom_data.value).toBe(399);
    expect(typeof e.custom_data.value).toBe("number");
    expect(e.custom_data.currency).toBe("UAH");
    expect(e.custom_data.content_ids).toEqual(["prd_potty"]);
    expect(e.custom_data.num_items).toBe(1);
  });
  test("копійки зберігаються: 380,50 грн → 380.5", () => {
    expect(purchaseCapiEvent({ ...order, total_minor: 38050 }, items, "https://x")!.custom_data.value).toBe(380.5);
  });
  test("event_id збігається з браузерним eventID (дедуплікація Pixel + CAPI)", () => {
    expect(purchaseCapiEvent(order, items, "https://x")!.event_id).toBe(purchaseEventId("ord_abc"));
    expect(purchaseEventId("ord_abc")).toBe("purchase-ord_abc");
  });
  test("сума 0 або некоректна — подію не надсилаємо (не вигадуємо value)", () => {
    expect(purchaseValue(0)).toBeNull();
    expect(purchaseValue(Number.NaN)).toBeNull();
    expect(purchaseCapiEvent({ ...order, total_minor: 0 }, items, "https://x")).toBeNull();
  });
  test("персональні дані лише в хешованому вигляді", () => {
    const e = purchaseCapiEvent(order, items, "https://x")!;
    expect(e.user_data.em[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(e)).not.toContain("Example.com");
  });
  test("агент користувача (не хешується) і місто доставки (хешоване, нормалізоване)", () => {
    const e = purchaseCapiEvent({ ...order, meta_ua: "Mozilla/5.0 (iPhone)", np_city: "м. Біла Церква, Київська обл." }, items, "https://x")!;
    expect(e.user_data.client_user_agent).toBe("Mozilla/5.0 (iPhone)");
    expect(normCity("м. Біла Церква, Київська обл.")).toBe("білацерква");
    expect(e.user_data.ct![0]).toBe(createHash("sha256").update("білацерква").digest("hex"));
  });
  test("PDF без доставки: міста немає, зайвих полів не надсилаємо", () => {
    const e = purchaseCapiEvent(order, items, "https://x")!;
    expect(e.user_data).not.toHaveProperty("ct");
    expect(e.user_data).not.toHaveProperty("client_user_agent");
  });
});
