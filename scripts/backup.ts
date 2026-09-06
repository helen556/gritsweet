import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

// Резервна копія SQLite: копіює файл бази в ./backups/ з датою в назві.
// Для PostgreSQL використовуйте pg_dump (див. README).
const url = process.env.DATABASE_URL ?? "file:./data/dev.db";
if (url.startsWith("postgres")) {
  console.log("Для PostgreSQL: pg_dump \"$DATABASE_URL\" > backups/$(date +%F).sql");
  process.exit(0);
}
const src = path.resolve(url.replace(/^file:/, ""));
const dir = path.resolve("backups");
fs.mkdirSync(dir, { recursive: true });
const dest = path.join(dir, `db-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.db`);
fs.copyFileSync(src, dest);
console.log(`Копію збережено: ${dest}. Не забудьте також скопіювати папку storage/private.`);
