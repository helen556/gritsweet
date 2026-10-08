import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import ActionForm from "@/components/admin/ActionForm";
import { saveSettingsAction, changePasswordAction } from "../../actions";

export const metadata = { title: "Налаштування" };
const F: [string, string, string?][] = [
  ["contact_email", "Email для зв’язку (на сайті)"], ["contact_phone", "Телефон (на сайті)"], ["contact_instagram", "Instagram (@нік або посилання)"], ["contact_telegram", "Telegram (@нік або посилання)"],
  ["payment_link_url", "Платіжне посилання (режим manual_link), https://…"], ["payment_link_note_uk", "Підказка до оплати (укр.)", "area"], ["payment_link_note_en", "Підказка до оплати (англ.)", "area"],
  ["seller_details_uk", "Реквізити продавця (укр., для оферти)", "area"], ["seller_details_en", "Реквізити продавця (англ.)", "area"],
];

export default async function Settings() {
  await requireAdmin("owner");
  const s = await getSettings();
  return (
    <div className="space-y-8">
      <section className="card p-5 sm:p-6">
        <h1 className="text-3xl text-moss-900">Налаштування</h1>
        <p className="mt-1 text-sm text-ink-soft">Ключі платіжного/email-провайдерів задаються лише змінними середовища на сервері, не тут.</p>
        <ActionForm action={saveSettingsAction} submit="Зберегти" className="mt-4 grid gap-4 sm:grid-cols-2">
          {F.map(([k, l, t]) => (
            <div key={k} className={`field ${t ? "sm:col-span-2" : ""}`}><label htmlFor={k}>{l}</label>
              {t ? <textarea id={k} name={k} rows={3} defaultValue={s[k as keyof typeof s]} className="input" /> : <input id={k} name={k} defaultValue={s[k as keyof typeof s]} className="input" />}</div>
          ))}
        </ActionForm>
      </section>
      <section className="card p-5 sm:p-6">
        <h2 className="text-2xl">Змінити пароль</h2>
        <ActionForm action={changePasswordAction} submit="Змінити пароль" className="mt-3 grid gap-3 sm:max-w-md">
          <div className="field"><label htmlFor="current">Поточний пароль</label><input id="current" name="current" type="password" autoComplete="current-password" className="input" /></div>
          <div className="field"><label htmlFor="next">Новий пароль (≥ 12 символів)</label><input id="next" name="next" type="password" autoComplete="new-password" className="input" /></div>
        </ActionForm>
      </section>
    </div>
  );
}
