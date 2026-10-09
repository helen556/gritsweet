import { db } from "@/db";
import { getAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { privateStorage } from "@/lib/storage";

/** Перегляд квитанції — лише для автентифікованого адміністратора, з журналом доступу. */
export async function GET(_req: Request, ctx: RouteContext<"/admin/receipt/[id]">) {
  const admin = await getAdmin();
  if (!admin) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const r = await db.selectFrom("receipts").selectAll().where("id", "=", id).executeTakeFirst();
  if (!r) return new Response("Not found", { status: 404 });
  const data = await privateStorage().get(r.storage_key);
  if (!data) return new Response("File missing", { status: 404 });
  await audit(admin, "receipt.view", "order", r.order_id, { receipt: r.id });
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": r.content_type, "content-disposition": `inline; filename="receipt-${r.id}.${r.storage_key.split(".").pop()}"`,
      "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      "x-robots-tag": "noindex",
    },
  });
}
