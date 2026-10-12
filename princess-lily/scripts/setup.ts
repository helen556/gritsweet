import "dotenv/config";
import { db } from "../src/db";
import { migrate } from "../src/db/migrate";
import { seed } from "../src/db/seed";
import { hashPassword, passwordProblem } from "../src/lib/auth";
import { newId } from "../src/lib/ids";

/**
 * Створює/оновлює схему та додає чернетку товару.
 * Якщо адміністраторів ще немає і задано ADMIN_EMAIL + ADMIN_INITIAL_PASSWORD — створює власницю (зручно для Vercel:
 * не потрібна локальна команда). Пароль має бути надійним; після входу змініть його в адмінці і приберіть змінну.
 */
async function main() {
  await migrate(db);
  await seed(db);
  let admins = await db.selectFrom("admin_users").select("id").execute();
  const email = (process.env.ADMIN_EMAIL ?? "").toLowerCase().trim();
  const pass = process.env.ADMIN_INITIAL_PASSWORD ?? "";
  if (!admins.length && email && pass) {
    const problem = passwordProblem(pass, email);
    if (problem) throw new Error(`ADMIN_INITIAL_PASSWORD: ${problem}`);
    await db.insertInto("admin_users").values({ id: newId("adm"), email, password_hash: await hashPassword(pass), role: "owner" }).execute();
    console.log(`Створено власницю ${email} (з ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD).`);
    admins = await db.selectFrom("admin_users").select("id").execute();
  }
  console.log(`Схема готова. Адміністраторів: ${admins.length}.${admins.length ? "" : " Створіть: npm run admin:create -- email@example.com"}`);
  await db.destroy();
}
main().catch((e) => { console.error(e); process.exit(1); });
