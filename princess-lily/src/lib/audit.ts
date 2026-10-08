import "server-only";
import { db } from "@/db";
import { newId } from "./ids";

export async function audit(admin: { id: string; email: string } | null, action: string, entity?: string, entityId?: string, details?: Record<string, unknown>) {
  await db.insertInto("audit_log").values({
    id: newId("aud"), admin_id: admin?.id ?? null, admin_email: admin?.email ?? null, action,
    entity: entity ?? null, entity_id: entityId ?? null, details: details ? JSON.stringify(details) : null,
  }).execute();
}
