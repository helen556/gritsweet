import { consumeDownload } from "@/lib/fulfillment";
import { privateStorage } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";

const MSG: Record<string, [number, string]> = {
  invalid: [404, "Посилання недійсне. / This link is not valid."],
  expired: [410, "Строк дії посилання минув. Напишіть нам — надішлемо нове. / This link has expired. Contact us for a new one."],
  exhausted: [410, "Ліміт завантажень вичерпано. Напишіть нам. / Download limit reached. Please contact us."],
  unpaid: [403, "Замовлення не оплачене. / The order is not paid."],
  no_file: [503, "Файл тимчасово недоступний. Напишіть нам. / File temporarily unavailable. Please contact us."],
};

/** Видача купленого PDF з приватного сховища за обмеженим у часі токеном, прив'язаним до оплаченого замовлення. */
export async function GET(_req: Request, ctx: RouteContext<"/api/download/[token]">) {
  if (!(await rateLimit("download", 30, 600))) return new Response("Too many requests", { status: 429 });
  const { token } = await ctx.params;
  const r = await consumeDownload(token);
  const priv = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" };
  if (!r.ok) { const [s, m] = MSG[r.reason]; return new Response(m, { status: s, headers: { ...priv, "content-type": "text/plain; charset=utf-8" } }); }
  const file = await privateStorage().get(r.key);
  if (!file) { const [s, m] = MSG.no_file; return new Response(m, { status: s, headers: { ...priv, "content-type": "text/plain; charset=utf-8" } }); }
  return new Response(new Uint8Array(file), {
    headers: { ...priv, "content-type": "application/pdf", "content-length": String(file.length), "content-disposition": `attachment; filename="${r.filename.replace(/[^\w.-]/g, "_")}"`, "x-content-type-options": "nosniff" },
  });
}
