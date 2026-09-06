import "dotenv/config";
import { db } from "../src/db";
import { newId } from "../src/lib/ids";
import { changeStatus, reschedule } from "../src/lib/orders";

// Перевірка на тестових даних: ліміт дня, закритий день, перенесення, знімок прайсу, дублікат ключа.
(async () => {
  const date = "2099-01-10";
  const mk = async (key: string) => { const id = newId(); await db.insertInto("orders").values({ id, customer_name: "ТЕСТ", phone: "+380950000000", desired_date: date, delivery_type: "AGREE", snapshot: JSON.stringify({ productName: "Тест", priceMin: 100000, estimateLabel: "1 000 грн" }), price_type: "FIXED", estimated_min: 100000, estimated_max: 100000, idempotency_key: key }).execute(); return id; };
  await db.deleteFrom("orders").where("customer_name", "=", "ТЕСТ").execute();
  await db.deleteFrom("calendar_days").where("date", "in", [date, "2099-01-11"]).execute();
  const a = await mk("smoke-a-" + Date.now()), b = await mk("smoke-b-" + Date.now());
  let dup = "ok";
  try { await mk("dup-" + a); await mk("dup-" + a); dup = "FAIL: duplicate accepted"; } catch { /* unique */ }
  console.log("дубль ключа відхилено:", dup);
  await db.insertInto("calendar_days").values({ date, is_closed: 0, note: "", day_limit: 1 }).execute();
  const r1 = await changeStatus(a, "CONFIRMED", "test"); const r2 = await changeStatus(b, "CONFIRMED", "test");
  console.log("ліміт 1: перше", r1, "друге", r2);
  await db.insertInto("calendar_days").values({ date: "2099-01-11", is_closed: 1, note: "", day_limit: null }).execute();
  console.log("перенос на закритий день:", await reschedule(a, "2099-01-11", "test"));
  console.log("перенос на відкритий день:", await reschedule(a, "2099-01-12", "test"));
  await db.updateTable("products").set({ price_min: 999900 }).where("name", "=", "Рафаело").execute();
  const o = await db.selectFrom("orders").select("estimated_min").where("id", "=", a).executeTakeFirstOrThrow();
  console.log("після зміни прайсу заявка незмінна:", o.estimated_min === 100000 ? "ok" : "FAIL");
  await db.updateTable("products").set({ price_min: 120000 }).where("name", "=", "Рафаело").execute();
  const ev = await db.selectFrom("order_events").select("type").where("order_id", "=", a).execute();
  console.log("історія подій:", ev.map((e) => e.type).join(", "));
  await db.deleteFrom("orders").where("customer_name", "=", "ТЕСТ").execute();
  await db.deleteFrom("calendar_days").where("date", "in", [date, "2099-01-11", "2099-01-12"]).execute();
  await db.destroy();
})();
