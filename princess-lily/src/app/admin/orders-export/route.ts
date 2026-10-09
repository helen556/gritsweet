import { getAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { listOrders, parseFilters } from "@/lib/crm";
import { ordersToPdf, ordersToXlsx } from "@/lib/export";
import { sumMinor } from "@/lib/money";

/**
 * Експорт ПОТОЧНОГО відфільтрованого списку (ті самі фільтри, що й таблиця; без пагінації) у .xlsx або .pdf.
 * Лише для адміністратора через сервер; журнал експорту; без кешування й публічних URL.
 * Не містить секретів, токенів чи приватних PDF.
 */
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return new Response("Unauthorized", { status: 401 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const fmt = sp.format === "pdf" ? "pdf" : "xlsx";
  const f = parseFilters(sp);
  const { rows, total } = await listOrders(f, { all: true, max: 5000 });
  const sum = sumMinor(rows.map((r) => r.total_minor));
  const period = f.from || f.to ? ` за ${f.from || "…"} — ${f.to || "…"}` : "";
  const title = `Замовлення${period} (${rows.length}${total > rows.length ? ` з ${total}` : ""})`;
  const body = fmt === "pdf" ? await ordersToPdf(rows, { title, sum }) : await ordersToXlsx(rows, { title, sum });
  await audit(admin, "orders.export", "orders", undefined, { format: fmt, count: rows.length, filters: { ...f, page: undefined, pageSize: undefined } });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": fmt === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="orders-${stamp}.${fmt}"`,
      "cache-control": "private, no-store", "x-robots-tag": "noindex",
    },
  });
}
