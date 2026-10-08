import { db } from "@/db";
import { messageAction } from "../../actions";

export const metadata = { title: "Звернення" };
export default async function Messages() {
  const rows = await db.selectFrom("contact_messages").selectAll().orderBy("created_at", "desc").limit(200).execute();
  return (
    <div className="space-y-4">
      <h1 className="text-3xl text-moss-900">Звернення</h1>
      {rows.map((m) => (
        <article key={m.id} className={`card p-5 ${m.status === "new" ? "border-gold" : ""}`}>
          <p className="text-sm text-ink-soft">{m.created_at} · {m.site_locale}{m.order_number && ` · замовлення ${m.order_number}`}</p>
          <p className="mt-1 font-semibold">{m.name} · <a className="underline" href={`mailto:${m.email}`}>{m.email}</a></p>
          <p className="mt-2 whitespace-pre-wrap">{m.message}</p>
          <form action={messageAction} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={m.id} />
            <div className="field"><label htmlFor={`st-${m.id}`}>Статус</label><select id={`st-${m.id}`} name="status" defaultValue={m.status} className="input"><option value="new">Нове</option><option value="in_progress">В роботі</option><option value="closed">Закрито</option></select></div>
            <div className="field flex-1"><label htmlFor={`n-${m.id}`}>Нотатка</label><input id={`n-${m.id}`} name="admin_note" defaultValue={m.admin_note} className="input" /></div>
            <button className="btn btn-ghost">Зберегти</button>
          </form>
        </article>
      ))}
      {!rows.length && <p className="text-ink-soft">Звернень поки немає.</p>}
    </div>
  );
}
