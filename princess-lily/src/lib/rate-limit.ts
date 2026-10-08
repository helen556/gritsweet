import "server-only";
import { db } from "@/db";
import { sha256 } from "./ids";
import { headers } from "next/headers";

export async function clientIpHash(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "local").split(",")[0].trim();
  return sha256(`ip:${ip}`).slice(0, 24); // IP не зберігаємо у відкритому вигляді
}

/** Ліміт на основі БД (працює і на кількох інстансах). true = дозволено. */
export async function rateLimitKey(key: string, max: number, windowSec: number): Promise<boolean> {
  const now = new Date();
  const row = await db.selectFrom("rate_limits").selectAll().where("key", "=", key).executeTakeFirst();
  if (!row || new Date(row.window_end) < now) {
    await db.deleteFrom("rate_limits").where("key", "=", key).execute();
    await db.insertInto("rate_limits").values({ key, count: 1, window_end: new Date(now.getTime() + windowSec * 1000).toISOString() }).execute();
    return true;
  }
  if (row.count >= max) return false;
  await db.updateTable("rate_limits").set({ count: row.count + 1 }).where("key", "=", key).execute();
  return true;
}
export async function rateLimit(scope: string, max: number, windowSec: number) {
  return rateLimitKey(`${scope}:${await clientIpHash()}`, max, windowSec);
}
