import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { effectivePaymentMode } from "@/lib/orders";
import { paymentConfig } from "@/lib/config";
import ActionForm from "@/components/admin/ActionForm";
import UploadForm from "@/components/admin/UploadForm";
import { saveSettingsAction, changePasswordAction } from "../../actions";

export const metadata = { title: "Налаштування" };
const F: [string, string, string?][] = [
  ["contact_email", "Email для зв’язку (на сайті)"], ["contact_phone", "Телефон (на сайті)"], ["contact_instagram", "Instagram (@нік або посилання)"], ["contact_telegram", "Telegram (@нік або посилання)"],
  ["payment_link_url", "Платіжне посилання (manual-link), https://… — сума в URL не дописується"], ["payment_link_note_uk", "Підказка до оплати (укр.)", "area"], ["payment_link_note_en", "Підказка до оплати (англ.)", "area"],
  ["seller_details_uk", "Реквізити продавця (укр., для оферти)", "area"], ["seller_details_en", "Реквізити продавця (англ.)", "area"],
  ["author_photo", "author_photo: порожньо — фото з пакета; none — без фото"],
];

export default async function Settings() {
  await requireAdmin("owner");
  const s = await getSettings();
  const effective = await effectivePaymentMode();
  const monoReady = !!paymentConfig().monoToken;
  return (
    <div className="space-y-8">
      <section className="card p-5 sm:p-6">
        <h1 className="text-3xl text-moss-900">Налаштування</h1>
        <p className="mt-1 text-sm text-ink-soft">Ключі платіжного/email-провайдерів задаються лише змінними середовища на сервері, не тут.</p>
        <ActionForm action={saveSettingsAction} submit="Зберегти" className="mt-4 grid gap-4 sm:grid-cols-2">
          <fieldset className="rounded-2xl border border-black/10 p-4 sm:col-span-2">
            <legend className="px-2 font-semibold">Оплата</legend>
            <div className="field"><label htmlFor="payment_mode">Режим оплати (paymentMode)</label>
              <select id="payment_mode" name="payment_mode" defaultValue={s.payment_mode || "manual_link"} className="input">
                <option value="manual_link">manual-link — посилання + ручна перевірка адміністратором</option>
                <option value="mono_acquiring">mono-acquiring — рахунок monobank на кожне замовлення (потрібен MONOBANK_TOKEN)</option>
                <option value="disabled">вимкнено — оформлення недоступне</option>
              </select>
              <p className="hint">Діє зараз: <strong>{effective === "disabled" ? "оплата вимкнена" : effective === "manual_link" ? "посилання + ручна перевірка" : "еквайринг / провайдер"}</strong>.
                {s.payment_mode === "mono_acquiring" && !monoReady && " ⚠️ MONOBANK_TOKEN не задано на сервері — режим не активний."}
                {" "}Еквайринг monobank ще не перевірений наживо — перед увімкненням зробіть тестовий платіж.</p></div>
          </fieldset>
          {F.filter(([k]) => k !== "payment_mode").map(([k, l, t]) => (
            <div key={k} className={`field ${t ? "sm:col-span-2" : ""}`}><label htmlFor={k}>{l}</label>
              {t ? <textarea id={k} name={k} rows={3} defaultValue={s[k as keyof typeof s]} className="input" /> : <input id={k} name={k} defaultValue={s[k as keyof typeof s]} className="input" />}</div>
          ))}
        </ActionForm>
      </section>
      <section className="card p-5 sm:p-6">
        <h2 className="text-2xl">Фото авторки (необов’язково)</h2>
        <p className="mt-1 text-sm text-ink-soft">Зараз: {s.author_photo === "none" ? "без фото" : s.author_photo ? "завантажене в адмінці" : "надане фото з пакета"}.
          Лише справжнє фото Лізи — не ілюстрацію Лілі. Поле «author_photo» у формі вище: порожньо = фото з пакета, <code>none</code> = без фото.</p>
        <UploadForm kind="author" targetId="author" accept="image/jpeg,image/png,image/webp" label="Завантажити інше фото авторки (JPG/PNG/WebP, до 10 МБ)" />
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
