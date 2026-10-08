import { Kysely, SqliteDialect, PostgresDialect } from "kysely";
import type { Database } from "./types";

// DATABASE_URL:
//   file:./data/dev.db           → SQLite (локальна розробка, один сервер)
//   postgres://user:pass@host/db → PostgreSQL (продакшен, напр. Supabase)
//   :memory:                     → SQLite у пам'яті (лише тести)
function createDb(): Kysely<Database> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL не задано (див. .env.example)");
  if (url.startsWith("postgres")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg");
    return new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: url, max: 3, ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: true } }),
      }),
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const BetterSqlite3 = require("better-sqlite3");
  const file = url.replace(/^file:/, "");
  if (file !== ":memory:") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodePath = require("node:path") as typeof import("node:path");
    fs.mkdirSync(nodePath.dirname(nodePath.resolve(file)), { recursive: true });
  }
  const database = new BetterSqlite3(file);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  return new Kysely<Database>({ dialect: new SqliteDialect({ database }) });
}

const g = globalThis as unknown as { __plDb?: Kysely<Database> };
export const db: Kysely<Database> = g.__plDb ?? createDb();
g.__plDb = db;

export const isPostgres = () => (process.env.DATABASE_URL ?? "").startsWith("postgres");
