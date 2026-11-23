/**
 * Події Meta Pixel — єдине місце, звідки їх надсилають компоненти (клієнтський код).
 * Усі події: currency UAH, content_type product, реальні id/назви/ціни товарів.
 * Нічого не надсилається, якщо піксель не завантажено (немає ID або відвідувач не дав згоду на рекламні cookie).
 * Кожна функція повертає true, якщо подію надіслано (або її вже надсилали раніше — для Purchase).
 */
import { trackPixel } from "@/components/tracking/consent";

export type PixelLine = { id: string; quantity: number; price?: number };

const ready = () => typeof window !== "undefined" && typeof window.fbq === "function";
const ids = (lines: PixelLine[]) => [...new Set(lines.map((l) => l.id))];
const contents = (lines: PixelLine[]) => lines.map((l) => ({ id: l.id, quantity: l.quantity, ...(l.price != null ? { item_price: l.price } : {}) }));

/** Відкриття сторінки товару. price — у гривнях. */
export function trackViewContent(p: { id: string; name: string; price: number }) {
  if (!ready()) return false;
  trackPixel("ViewContent", { content_name: p.name, content_ids: [p.id], content_type: "product", currency: "UAH", value: p.price });
  return true;
}

/** Натискання «До кошика». price — ціна одиниці в гривнях. */
export function trackAddToCart(p: { id: string; name: string; price: number; quantity: number }) {
  if (!ready()) return false;
  trackPixel("AddToCart", {
    content_name: p.name, content_ids: [p.id], content_type: "product", currency: "UAH",
    value: Math.round(p.price * p.quantity * 100) / 100, contents: [{ id: p.id, quantity: p.quantity }],
  });
  return true;
}

/** Відкриття оформлення замовлення (/uk/checkout, /en/checkout). value — сума кошика в гривнях. */
export function trackInitiateCheckout(p: { lines: PixelLine[]; value: number }) {
  if (!ready()) return false;
  trackPixel("InitiateCheckout", {
    content_ids: ids(p.lines), content_type: "product", currency: "UAH", value: p.value,
    num_items: p.lines.reduce((a, l) => a + l.quantity, 0), contents: contents(p.lines),
  });
  return true;
}

/**
 * Покупка — один раз на замовлення: позначка в браузері не дає повторити подію при оновленні сторінки,
 * а eventID збігається з Conversions API, тож Meta не рахує її двічі й з різних пристроїв.
 */
export function trackPurchase(p: { orderId: string; eventId: string; lines: PixelLine[]; value: number }) {
  const key = `pl_px_${p.eventId}`;
  try { if (localStorage.getItem(key)) return true; } catch {}
  // value — обов'язково додатне число (фактична сума замовлення); без нього подію не надсилаємо
  const value = Number(p.value);
  if (!Number.isFinite(value) || value <= 0) return true;
  if (!ready()) return false;
  trackPixel("Purchase", {
    content_ids: ids(p.lines), content_type: "product", currency: "UAH", value: Math.round(value * 100) / 100,
    num_items: p.lines.reduce((a, l) => a + l.quantity, 0), contents: contents(p.lines),
  }, p.eventId);
  try { localStorage.setItem(key, "1"); } catch {}
  return true;
}
