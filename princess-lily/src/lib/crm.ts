import "server-only";
import { db } from "@/db";
import { sql } from "kysely";

/** Час у БД — UTC (ISO). Показ — Europe/Kyiv. */
export const TZ = "Europe/Kyiv";
export function parseDbTime(s: string | null): Date | null {
  if (!s) return null;
  const iso = s.includes("T") ? s : s.replace(" ", "T") + (/[zZ]|[+-]\d\d/.test(s.slice(10)) ? "" : "Z");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
export function kyiv(s: string | null, withSeconds = false) {
  const d = parseDbTime(s);
  return d ? d.toLocaleString("uk-UA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", ...(withSeconds ? { second: "2-digit" } : {}) }) : "—";
}
/** Початок доби YYYY-MM-DD за Києвом → UTC ISO (з урахуванням літнього/зимового часу). */
export function kyivDayStartUtc(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const guess = new Date(`${day}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23", day: "2-digit" }).formatToParts(guess);
  const h = Number(parts.find((p) => p.type === "hour")!.value);
  const dd = Number(parts.find((p) => p.type === "day")!.value);
  // зсув Києва від UTC (2 або 3 год)
  const offset = dd === guess.getUTCDate() ? h : h - 24;
  return new Date(guess.getTime() - offset * 3600_000).toISOString();
}

export const PAYMENT_LABEL: Record<string, string> = { pending_payment: "Очікує оплату", pending_verification: "Очікує перевірки", paid: "Оплачено", failed: "Неуспішно", cancelled: "Скасовано" };
export const SHIPPING_LABEL: Record<string, string> = { awaiting_payment: "Після оплати", to_ship: "До відправлення", shipped: "Відправлено", delivered: "Доставлено", cancelled: "Скасовано" };
export const DIGITAL_LABEL: Record<string, string> = { awaiting_payment: "Після оплати", ready: "Готується лист", sent: "Посилання надіслано", email_failed: "Лист не надіслано (повтор)", email_not_configured: "Email не налаштовано" };
export const ORDER_LABEL: Record<string, string> = { new: "Нове", processing: "В роботі", completed: "Виконано", cancelled: "Скасовано" };
export const METHOD_LABEL: Record<string, string> = { manual_link: "Посилання (ручна перевірка)", mono: "monobank еквайринг", test: "Тестовий провайдер" };
export const KIND_LABEL = { pdf: "PDF", print: "Друк", mixed: "Змішане" } as const;

export type CrmFilters = {
  q?: string; from?: string; to?: string; payment?: string; shipping?: string; kind?: "pdf" | "print" | "mixed" | ""; status?: string;
  sort?: "created_at" | "total_minor" | "payment_status"; dir?: "asc" | "desc"; page?: number; pageSize?: number;
};

export function parseFilters(sp: Record<string, string | string[] | undefined>): CrmFilters {
  const g = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim().slice(0, 100) : "");
  const sort = ["created_at", "total_minor", "payment_status"].includes(g("sort")) ? (g("sort") as CrmFilters["sort"]) : "created_at";
  return {
    q: g("q"), from: g("from"), to: g("to"),
    payment: g("payment") in PAYMENT_LABEL ? g("payment") : "",
    shipping: g("shipping") === "none" || g("shipping") in SHIPPING_LABEL ? g("shipping") : "",
    kind: (["pdf", "print", "mixed"].includes(g("kind")) ? g("kind") : "") as CrmFilters["kind"],
    status: g("status") in ORDER_LABEL ? g("status") : "",
    sort, dir: g("dir") === "asc" ? "asc" : "desc",
    page: Math.max(1, Number(g("page")) || 1), pageSize: [25, 50, 100].includes(Number(g("size"))) ? Number(g("size")) : 25,
  };
}

function base(f: CrmFilters) {
  let q = db.selectFrom("orders as o");
  if (f.q) {
    const like = `%${f.q.toLowerCase()}%`;
    const digits = f.q.replace(/\D/g, "");
    q = q.where((eb) => eb.or([
      eb("o.search_text", "like", like),
      ...(digits.length >= 4 ? [eb("o.search_text", "like", `%${digits.slice(-9)}%`)] : []),
      eb(eb.fn("lower", ["o.number"]), "like", like), eb(eb.fn("lower", ["o.email"]), "like", like),
    ]));
  }
  const from = f.from ? kyivDayStartUtc(f.from) : null;
  const toStart = f.to ? kyivDayStartUtc(f.to) : null;
  if (from) q = q.where("o.created_at", ">=", from);
  if (toStart) q = q.where("o.created_at", "<", new Date(new Date(toStart).getTime() + 24 * 3600_000 + 3600_000).toISOString()); // +1 доба (±1 год на зміну часу)
  if (f.payment) q = q.where("o.payment_status", "=", f.payment as never);
  if (f.status) q = q.where((eb) => eb(eb.fn.coalesce("o.order_status", sql.lit("new")), "=", f.status!));
  if (f.shipping === "none") q = q.where("o.shipping_required", "=", 0);
  else if (f.shipping) q = q.where((eb) => eb.exists(eb.selectFrom("fulfillments as f").select("f.id").whereRef("f.order_id", "=", "o.id").where("f.kind", "=", "shipping").where("f.status", "=", f.shipping!)));
  const itemsOf = (fmt: "pdf" | "print") => db.selectFrom("order_items as i").select("i.order_id").where("i.format", "=", fmt);
  if (f.kind === "pdf") q = q.where("o.id", "in", itemsOf("pdf")).where("o.id", "not in", itemsOf("print"));
  if (f.kind === "print") q = q.where("o.id", "in", itemsOf("print")).where("o.id", "not in", itemsOf("pdf"));
  if (f.kind === "mixed") q = q.where("o.id", "in", itemsOf("pdf")).where("o.id", "in", itemsOf("print"));
  return q;
}

export type CrmRow = Awaited<ReturnType<typeof listOrders>>["rows"][number];

export async function listOrders(f: CrmFilters, opts: { all?: boolean; max?: number } = {}) {
  const totals = await base(f).select(({ fn }) => [fn.countAll<number>().as("n"), fn.sum<number>("o.total_minor").as("sum")]).executeTakeFirst();
  let q = base(f).selectAll("o").orderBy(`o.${f.sort ?? "created_at"}`, f.dir ?? "desc").orderBy("o.id", "desc");
  if (!opts.all) q = q.limit(f.pageSize ?? 25).offset(((f.page ?? 1) - 1) * (f.pageSize ?? 25));
  else q = q.limit(opts.max ?? 5000);
  const orders = await q.execute();
  const ids = orders.map((o) => o.id).concat("");
  const [items, fuls] = await Promise.all([
    db.selectFrom("order_items").selectAll().where("order_id", "in", ids).execute(),
    db.selectFrom("fulfillments").selectAll().where("order_id", "in", ids).execute(),
  ]);
  const rows = orders.map((o) => {
    const its = items.filter((i) => i.order_id === o.id);
    const fmts = new Set(its.map((i) => i.format));
    const ship = fuls.find((x) => x.order_id === o.id && x.kind === "shipping");
    const dig = fuls.find((x) => x.order_id === o.id && x.kind === "digital");
    return {
      ...o,
      kind: (fmts.size > 1 ? "mixed" : fmts.has("print") ? "print" : "pdf") as keyof typeof KIND_LABEL,
      itemsText: its.map((i) => `${i.title_snapshot} — ${i.format === "pdf" ? "PDF" : "друк"}, ${i.book_locale === "uk" ? "укр." : "англ."} × ${i.quantity}`).join("; "),
      shippingStatus: ship?.status ?? null, ttn: ship?.ttn ?? null, digitalStatus: dig?.status ?? null,
      recipient: o.recipient_last_name ? `${o.recipient_first_name ?? ""} ${o.recipient_last_name}`.trim() : null,
    };
  });
  return { rows, total: Number(totals?.n ?? 0), sum: Number(totals?.sum ?? 0) };
}

export function filtersToQuery(f: CrmFilters, over: Record<string, string | number | undefined> = {}) {
  const q = new URLSearchParams();
  const v: Record<string, string | number | undefined> = { q: f.q, from: f.from, to: f.to, payment: f.payment, shipping: f.shipping, kind: f.kind, status: f.status, sort: f.sort, dir: f.dir, page: f.page, size: f.pageSize, ...over };
  for (const [k, val] of Object.entries(v)) if (val !== undefined && val !== "" && !(k === "page" && val === 1) && !(k === "size" && val === 25) && !(k === "sort" && val === "created_at") && !(k === "dir" && val === "desc")) q.set(k, String(val));
  return q.toString();
}
