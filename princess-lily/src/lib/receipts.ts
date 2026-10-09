import "server-only";
import { db } from "@/db";
import { newId } from "./ids";
import { privateStorage } from "./storage";
import { logOrderEvent } from "./events";

/** Тип визначається за вмістом (магічні байти), а не за назвою чи заголовком браузера. */
export function sniffReceipt(buf: Buffer): { ext: "pdf" | "jpg" | "png" | "webp"; type: string } | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return { ext: "pdf", type: "application/pdf" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", type: "image/png" };
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return { ext: "webp", type: "image/webp" };
  return null;
}

export const MAX_RECEIPTS_PER_ORDER = 5;

export async function saveReceipt(orderId: string, buf: Buffer, originalName: string, uploadedBy: string, maxBytes: number) {
  if (!buf.length || buf.length > maxBytes) return { ok: false as const, error: "size" };
  const kind = sniffReceipt(buf);
  if (!kind) return { ok: false as const, error: "type" };
  const count = await db.selectFrom("receipts").select(({ fn }) => fn.countAll<number>().as("n")).where("order_id", "=", orderId).executeTakeFirst();
  if (Number(count?.n ?? 0) >= MAX_RECEIPTS_PER_ORDER) return { ok: false as const, error: "limit" };
  const id = newId("rcp").toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const key = `receipts/${orderId.toLowerCase().replace(/[^a-z0-9_-]/g, "")}/${id}.${kind.ext}`;
  await privateStorage().put(key, buf, kind.type);
  await db.insertInto("receipts").values({
    id, order_id: orderId, storage_key: key, content_type: kind.type, size_bytes: buf.length,
    original_name: originalName.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || `receipt.${kind.ext}`, uploaded_by: uploadedBy, created_at: new Date().toISOString(),
  }).execute();
  await logOrderEvent(orderId, "receipt", null, null, uploadedBy, `Додано квитанцію (${kind.ext}, ${Math.round(buf.length / 1024)} КБ)`);
  return { ok: true as const, id };
}
