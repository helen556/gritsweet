import "dotenv/config";
import { db } from "../src/db";
import { migrate } from "../src/db/migrate";
import { seed } from "../src/db/seed";

/** Створює/оновлює схему та додає чернетку товару. Адміністратора створює окрема команда admin:create. */
async function main() {
  await migrate(db);
  await seed(db);
  const admins = await db.selectFrom("admin_users").select("id").execute();
  console.log(`Схема готова. Адміністраторів: ${admins.length}.${admins.length ? "" : " Створіть: npm run admin:create -- email@example.com"}`);
  await db.destroy();
}
main().catch((e) => { console.error(e); process.exit(1); });
