import "server-only";
import { db } from "@/db";
import { sql, type Transaction } from "kysely";
import type { Database } from "@/db/types";
import { isPostgres } from "@/db";
import { todayKyiv } from "./dates";
import { getSettings } from "./settings";

export const ACTIVE_STATUSES = ["CONFIRMED", "IN_PROGRESS"] as const;

/** Публічна доступність: лише закриті дні (без приміток, лімітів чи замовлень). */
export async function getPublicClosedDates(from: string, to: string): Promise<string[]> {
  const rows = await db.selectFrom("calendar_days").select("date").where("is_closed", "=", 1).where("date", ">=", from).where("date", "<=", to).execute();
  return rows.map((r) => r.date);
}

export type Availability = { ok: true; urgent: boolean } | { ok: false; reason: string };

/** Серверна перевірка бажаної дати для заявки. */
export async function checkDesiredDate(date: string): Promise<Availability> {
  const today = todayKyiv();
  if (date < today) return { ok: false, reason: "Ця дата вже минула." };
  const day = await db.selectFrom("calendar_days").selectAll().where("date", "=", date).executeTakeFirst();
  if (day?.is_closed) return { ok: false, reason: "На цю дату Дар’я не приймає замовлення. Оберіть іншу." };
  const lead = Number((await getSettings()).lead_days || "7");
  const diff = Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
  return { ok: true, urgent: diff < lead };
}

/** Захоплює рядок дня в транзакції, щоб одночасні підтвердження не перевищили ліміт. */
export async function lockDay(trx: Transaction<Database>, date: string) {
  const existing = await trx.selectFrom("calendar_days").selectAll().where("date", "=", date).executeTakeFirst();
  if (!existing) {
    await trx.insertInto("calendar_days").values({ date, is_closed: 0, note: "", day_limit: null }).onConflict((oc) => oc.column("date").doNothing()).execute();
  }
  if (isPostgres) {
    const r = await sql<{ date: string; is_closed: number; note: string; day_limit: number | null }>`select * from calendar_days where date = ${date} for update`.execute(trx);
    return r.rows[0];
  }
  // SQLite: транзакція з першим записом стає ексклюзивною для інших з'єднань
  return (await trx.selectFrom("calendar_days").selectAll().where("date", "=", date).executeTakeFirstOrThrow());
}

export async function countActiveOrders(trx: Transaction<Database>, date: string, excludeId?: string): Promise<number> {
  let q = trx.selectFrom("orders").select(({ fn }) => fn.countAll<number>().as("n")).where("desired_date", "=", date).where("status", "in", [...ACTIVE_STATUSES]);
  if (excludeId) q = q.where("id", "!=", excludeId);
  return Number((await q.executeTakeFirstOrThrow()).n);
}
