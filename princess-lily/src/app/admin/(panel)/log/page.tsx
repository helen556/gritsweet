import { db } from "@/db";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Журнал дій" };
export default async function Log() {
  await requireAdmin("owner");
  const rows = await db.selectFrom("audit_log").selectAll().orderBy("created_at", "desc").limit(300).execute();
  return (
    <div>
      <h1 className="text-3xl text-moss-900">Журнал дій адміністраторів</h1>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-black/6 bg-paper">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead><tr className="border-b border-black/10"><th className="p-3">Час (UTC)</th><th>Хто</th><th>Дія</th><th>Об’єкт</th><th>Деталі</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id} className="border-b border-black/5 align-top"><td className="p-3 whitespace-nowrap">{r.created_at}</td><td>{r.admin_email ?? "система"}</td><td>{r.action}</td><td>{r.entity} {r.entity_id}</td><td className="max-w-xs break-words font-mono text-xs">{r.details}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
