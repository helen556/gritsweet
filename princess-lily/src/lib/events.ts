import "server-only";
import { db } from "@/db";
import type { OrderEventsTable } from "@/db/types";
import { newId } from "./ids";

/** Хронологія замовлення: зміни статусів (замовлення, оплата, PDF, доставка), нотатки, квитанції — з відповідальним. */
export async function logOrderEvent(orderId: string, kind: OrderEventsTable["kind"], from: string | null, to: string | null, actor: string, details?: string) {
  await db.insertInto("order_events").values({
    id: newId("oev"), order_id: orderId, kind, from_status: from, to_status: to, actor: actor.slice(0, 200),
    details: details ? details.slice(0, 1000) : null, created_at: new Date().toISOString(),
  }).execute();
}

/** Дозволені переходи загального статусу замовлення (окремо від оплати й доставки). */
export const ORDER_TRANSITIONS: Record<string, string[]> = {
  new: ["processing", "cancelled"],
  processing: ["completed", "cancelled", "new"],
  completed: ["processing"],
  cancelled: [],
};
