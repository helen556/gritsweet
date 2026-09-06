import "dotenv/config";
import { db } from "../src/db";
import { randomBytes, createHash } from "node:crypto";

// Відновлення доступу без email-сервісу: запуск на сервері друкує одноразове посилання (30 хв).
// Використання: npm run admin:reset -- admin@example.com
(async () => {
  const email = process.argv[2]?.toLowerCase();
  if (!email) { console.error("Вкажіть email адміністратора"); process.exit(1); }
  const user = await db.selectFrom("admin_users").select("id").where("email", "=", email).executeTakeFirst();
  if (!user) { console.error("Користувача не знайдено"); process.exit(1); }
  const token = randomBytes(32).toString("base64url");
  await db.updateTable("admin_users").set({ reset_token_hash: createHash("sha256").update(token).digest("hex"), reset_token_expiry: new Date(Date.now() + 30 * 60_000).toISOString() }).where("id", "=", user.id).execute();
  console.log(`${process.env.APP_URL ?? "http://localhost:3000"}/admin/reset?token=${token}`);
  await db.destroy();
})();
