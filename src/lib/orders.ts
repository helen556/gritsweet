import "server-only";
import { db } from "@/db";
import type { OrderStatus, Order } from "@/db/types";
import { newId } from "./ids";
import { lockDay, countActiveOrders } from "./calendar";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "Нова", CLARIFYING: "Уточнення", CONFIRMED: "Підтверджена", IN_PROGRESS: "У роботі", DONE: "Виконана", REJECTED: "Відхилена", CANCELLED: "Скасована",
};
export const STATUS_FLOW: OrderStatus[] = ["NEW", "CLARIFYING", "CONFIRMED", "IN_PROGRESS", "DONE"];
export const ALL_STATUSES = Object.keys(STATUS_LABELS) as OrderStatus[];

export type Snapshot = {
  categoryName: string; productId: string; productName: string; unit: string;
  qty: number; qtyLabel: string; filling?: string; sizeLabel?: string; selections?: { label: string; value: string }[];
  priceType: string; priceMin: number | null; priceMax: number | null; estimateLabel: string;
  deliveryLabel: string; consentAt: string;
};

export function addEvent(orderId: string, type: string, payload: Record<string, unknown> = {}) {
  return db.insertInto("order_events").values({ id: newId(), order_id: orderId, type, payload: JSON.stringify(payload) }).execute();
}

export async function getOrder(id: string) {
  const order = await db.selectFrom("orders").selectAll().where("id", "=", id).executeTakeFirst();
  if (!order) return null;
  const events = await db.selectFrom("order_events").selectAll().where("order_id", "=", id).orderBy("created_at", "desc").execute();
  return { order, snapshot: JSON.parse(order.snapshot) as Snapshot, events };
}

export async function listOrders(f: { status?: OrderStatus | "ALL"; from?: string; to?: string; limit?: number }) {
  let q = db.selectFrom("orders").selectAll().orderBy("created_at", "desc");
  if (f.status && f.status !== "ALL") q = q.where("status", "=", f.status);
  if (f.from) q = q.where("desired_date", ">=", f.from);
  if (f.to) q = q.where("desired_date", "<=", f.to);
  return q.limit(f.limit ?? 200).execute();
}

/** Зміна статусу з перевіркою ліміту дня при підтвердженні. */
export async function changeStatus(id: string, status: OrderStatus, adminEmail: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return db.transaction().execute(async (trx) => {
    const order = await trx.selectFrom("orders").selectAll().where("id", "=", id).executeTakeFirst();
    if (!order) return { ok: false, error: "Заявку не знайдено" };
    if (order.status === status) return { ok: true };
    if (status === "CONFIRMED" || status === "IN_PROGRESS") {
      const day = await lockDay(trx, order.desired_date);
      if (day.is_closed && !["CONFIRMED", "IN_PROGRESS"].includes(order.status)) return { ok: false, error: "Ця дата закрита. Спершу відкрийте день або перенесіть замовлення." };
      if (day.day_limit != null) {
        const n = await countActiveOrders(trx, order.desired_date, id);
        if (n >= day.day_limit) return { ok: false, error: `Ліміт на ${order.desired_date} вичерпано (${day.day_limit}).` };
      }
    }
    await trx.updateTable("orders").set({ status, updated_at: new Date().toISOString() }).where("id", "=", id).execute();
    await trx.insertInto("order_events").values({ id: newId(), order_id: id, type: "STATUS", payload: JSON.stringify({ from: order.status, to: status, by: adminEmail }) }).execute();
    return { ok: true };
  });
}

/** Перенесення на іншу дату зі збереженням історії. */
export async function reschedule(id: string, newDate: string, adminEmail: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return db.transaction().execute(async (trx) => {
    const order = await trx.selectFrom("orders").selectAll().where("id", "=", id).executeTakeFirst();
    if (!order) return { ok: false, error: "Заявку не знайдено" };
    if (["CONFIRMED", "IN_PROGRESS"].includes(order.status)) {
      const day = await lockDay(trx, newDate);
      if (day.is_closed) return { ok: false, error: "Нова дата закрита." };
      if (day.day_limit != null && (await countActiveOrders(trx, newDate, id)) >= day.day_limit) return { ok: false, error: "На нову дату вичерпано ліміт." };
    }
    await trx.updateTable("orders").set({ desired_date: newDate, updated_at: new Date().toISOString() }).where("id", "=", id).execute();
    await trx.insertInto("order_events").values({ id: newId(), order_id: id, type: "RESCHEDULE", payload: JSON.stringify({ from: order.desired_date, to: newDate, by: adminEmail }) }).execute();
    return { ok: true };
  });
}

export type OrderWithSnapshot = Order & { snap: Snapshot };
export const withSnap = (o: Order): OrderWithSnapshot => ({ ...o, snap: JSON.parse(o.snapshot) });
