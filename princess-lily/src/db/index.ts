import { Kysely, SqliteDialect, PostgresDialect } from "kysely";
import type { Database } from "./types";

// DATABASE_URL:
//   file:./data/dev.db           → SQLite (локальна розробка, один сервер)
//   postgres://user:pass@host/db → PostgreSQL (продакшен, напр. Supabase)
//   :memory:                     → SQLite у пам'яті (лише тести)
/** DATABASE_URL, або POSTGRES_URL / POSTGRES_URL_NON_POOLING, які Vercel задає автоматично при підключенні Neon/Supabase. */
export function databaseUrl(): string {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || "";
}
/**
 * SSL для PostgreSQL: перевірка сертифіката за замовчуванням.
 * DATABASE_SSL=no-verify — шифрування без перевірки ланцюжка (деякі пулери Supabase), DATABASE_SSL=off — без SSL (лише локально).
 */
function sslOption(url: string) {
  const mode = process.env.DATABASE_SSL ?? "";
  if (mode === "off" || /@(localhost|127\.0\.0\.1)[:/]/.test(url)) return undefined;
  if (mode === "no-verify") return { rejectUnauthorized: false };
  return { rejectUnauthorized: true };
}
/**
 * sslmode у рядку підключення перекриває налаштування ssl у pg — прибираємо його, керуємо через DATABASE_SSL.
 * Пулер Supabase на порту 5432 працює в session-режимі (не більше 15 клієнтів на весь сайт) — на Vercel кожен
 * екземпляр функції тримає свої з'єднання, і ліміт швидко вичерпується. Переводимо на transaction-режим (6543).
 */
export function normalizePgUrl(url: string) {
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    if (u.hostname.endsWith(".pooler.supabase.com") && (u.port === "5432" || u.port === "")) u.port = "6543";
    return u.toString();
  } catch { return url; }
}

function createDb(): Kysely<Database> {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL не задано (див. .env.example)");
  if (url.startsWith("postgres")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg");
    // Короткий idle-таймаут: між візитами функцію «заморожують», і старе з'єднання з пулером рветься.
    const pool = new Pool({ connectionString: normalizePgUrl(url), max: 2, ssl: sslOption(url), idleTimeoutMillis: 5000, connectionTimeoutMillis: 10000, keepAlive: true });
    // Обірване простоююче з'єднання не повинно валити весь процес — пул просто відкине його.
    pool.on("error", (e: Error) => console.error("[db] idle client error:", e.message));
    // На Vercel: функція не «засинає», доки пул не прибере простоюючі з'єднання.
    if (process.env.VERCEL) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@vercel/functions").attachDatabasePool(pool);
    }
    return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
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

export const isPostgres = () => databaseUrl().startsWith("postgres");
