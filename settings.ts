import "server-only";
import { db } from "@/db";
import { cache } from "react";

export const getSettings = cache(async (): Promise<Record<string, string>> => {
  const rows = await db.selectFrom("settings").selectAll().execute();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
});
export async function setSetting(key: string, value: string) {
  const exists = await db.selectFrom("settings").select("key").where("key", "=", key).executeTakeFirst();
  if (exists) await db.updateTable("settings").set({ value }).where("key", "=", key).execute();
  else await db.insertInto("settings").values({ key, value }).execute();
}
