import "dotenv/config";
import { randomBytes } from "node:crypto";
import { db } from "../src/db";
import { migrate } from "../src/db/migrate";
import { hashPassword, passwordProblem } from "../src/lib/auth";
import { newId } from "../src/lib/ids";

/**
 * npm run admin:create -- owner@example.com [owner|staff]
 * Пароль: змінна ADMIN_PASSWORD (≥12 символів) або генерується випадковий і виводиться ОДИН раз.
 * Якщо користувач існує — пароль скидається, усі його сесії анулюються.
 */
async function main() {
  const email = (process.argv[2] ?? "").toLowerCase().trim();
  const role = process.argv[3] === "staff" ? "staff" : "owner";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Вкажіть email: npm run admin:create -- you@example.com");
  const password = process.env.ADMIN_PASSWORD || randomBytes(15).toString("base64url");
  const problem = passwordProblem(password, email);
  if (problem) throw new Error(problem);
  await migrate(db);
  const hash = await hashPassword(password);
  const u = await db.selectFrom("admin_users").select(["id", "session_version"]).where("email", "=", email).executeTakeFirst();
  if (u) await db.updateTable("admin_users").set({ password_hash: hash, role, is_active: 1, session_version: u.session_version + 1 }).where("id", "=", u.id).execute();
  else await db.insertInto("admin_users").values({ id: newId("adm"), email, password_hash: hash, role }).execute();
  console.log(`Адміністратор ${email} (${role}) ${u ? "оновлений" : "створений"}.`);
  if (!process.env.ADMIN_PASSWORD) console.log(`Тимчасовий пароль (показується один раз): ${password}`);
  await db.destroy();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
