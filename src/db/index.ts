import { Kysely, SqliteDialect, PostgresDialect } from "kysely";
import type { Database } from "./types";

// DATABASE_URL:
//   file:./data/dev.db          → SQLite (локальна розробка)
//   postgres://user:pass@host/db → PostgreSQL (продакшен, напр. Supabase)
function createDb(): Kysely<Database> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL не задано. Для Vercel вкажіть рядок підключення Supabase (postgres://…), локально — file:./data/dev.db");
  if (url.startsWith("postgres")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg");
    return new Kysely<Database>({
      dialect: new PostgresDialect({ pool: new Pool({ connectionString: url, max: 3, ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false } }) }),
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const BetterSqlite3 = require("better-sqlite3");
  const path = url.replace(/^file:/, "");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodePath = require("node:path") as typeof import("node:path");
  fs.mkdirSync(nodePath.dirname(nodePath.resolve(path)), { recursive: true });
  const database = new BetterSqlite3(path);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  return new Kysely<Database>({ dialect: new SqliteDialect({ database }) });
}

const globalForDb = globalThis as unknown as { __db?: Kysely<Database> };
export const db = globalForDb.__db ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.__db = db;

export const isPostgres = (process.env.DATABASE_URL ?? "").startsWith("postgres");
