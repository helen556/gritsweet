import "server-only";
import { db } from "@/db";

/** Налаштування, які власниця змінює в адмінці (контакти, платіжне посилання). Не секрети. */
export const SETTING_KEYS = [
  "contact_email", "contact_phone", "contact_instagram", "contact_telegram",
  "payment_link_url", "payment_link_note_uk", "payment_link_note_en",
  "seller_details_uk", "seller_details_en",
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export async function getSettings(): Promise<Record<SettingKey, string>> {
  const rows = await db.selectFrom("settings").selectAll().execute();
  const out = Object.fromEntries(SETTING_KEYS.map((k) => [k, ""])) as Record<SettingKey, string>;
  for (const r of rows) if ((SETTING_KEYS as readonly string[]).includes(r.key)) out[r.key as SettingKey] = r.value;
  return out;
}
export async function setSetting(key: SettingKey, value: string) {
  const exists = await db.selectFrom("settings").select("key").where("key", "=", key).executeTakeFirst();
  if (exists) await db.updateTable("settings").set({ value }).where("key", "=", key).execute();
  else await db.insertInto("settings").values({ key, value }).execute();
}
