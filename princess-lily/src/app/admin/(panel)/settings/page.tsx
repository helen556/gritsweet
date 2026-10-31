import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { effectivePaymentMode } from "@/lib/orders";
import { emailConfig, paymentConfig } from "@/lib/config";
import { legalStatus } from "@/lib/legal";
import ActionForm from "@/components/admin/ActionForm";
import UploadForm from "@/components/admin/UploadForm";
import { saveSettingsAction, changePasswordAction, storageCheckAction, emailTestAction } from "../../actions";
import { db } from "@/db";
import { BUNDLE_CONTENTS } from "@/lib/book-specs";

export const metadata = { title: "Налаштування" };
const F: [string, string, string?][] = [
  ["contact_email", "Email для зв’язку (на сайті)"], ["contact_phone", "Телефон (на сайті)"], ["contact_instagram", "Instagram (@нік або посилання)"], ["contact_telegram", "Telegram (@нік або посилання)"],
  ["payment_link_url", "Платіжне посилання (manual-link), https://… — сума в URL не дописується"], ["payment_link_note_uk", "Підказка до оплати (укр.)", "area"], ["payment_link_note_en", "Підказка до оплати (англ.)", "area"],
  ["seller_details_uk", "Реквізити продавця (укр.): ПІБ ФОП / назва, ІПН або ЄДРПОУ, адреса", "area"], ["seller_details_en", "Реквізити продавця (англ.)", "area"],
  ["legal_retention_uk", "Строк зберігання даних замовлень (укр., для політики конфіденційності)", "area"], ["legal_retention_en", "Строк зберігання даних (англ.)", "area"],
  ["author_photo", "author_photo: порожньо — фото з пакета; none — без фото"],
  ["books_photo", "books_photo: заповнюється завантаженням нижче; none — сховати блок"],
];

export default async function Settings() {
  await requireAdmin("owner");
  const s = await getSettings();
  const effective = await effectivePaymentMode();
  const monoReady = !!paymentConfig().monoToken;
  const legal = await legalStatus();
  const mail = emailConfig();
  // книжки (не комплекти): кожна мовна версія PDF має мати файл
  const pv = await db.selectFrom("product_variants as v").innerJoin("products as p", "p.id", "v.product_id").innerJoin("product_translations as t", (j) => j.onRef("t.product_id", "=", "p.id").on("t.locale", "=", "uk"))
    .select(["v.private_pdf_key", "v.book_locale", "t.title", "p.id"]).where("v.format", "=", "pdf").where("p.status", "!=", "draft").orderBy("p.sort_order").orderBy("v.book_locale", "desc").execute();
  const pdfs = pv.filter((x) => !BUNDLE_CONTENTS[x.id]).map((x) => ({ ok: !!x.private_pdf_key, label: `${x.title} (${x.book_locale === "uk" ? "UA" : "EN"})` }));
  return (
    <div className="space-y-8">
      <section className="card p-5 sm:p-6">
        <h1 className="text-3xl text-plum-900">Налаштування</h1>
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
          <fieldset className="rounded-2xl border border-black/10 p-4 sm:col-span-2">
            <legend className="px-2 font-semibold">Оферта й політика конфіденційності</legend>
            <div className="field"><label htmlFor="legal_approved">Публікація</label>
              <select id="legal_approved" name="legal_approved" defaultValue={s.legal_approved === "1" ? "1" : ""} className="input">
                <option value="">не опубліковано — на сайті примітка «документ готується»</option>
                <option value="1">тексти погоджено — опублікувати</option>
              </select>
              <p className="hint">Зараз: <strong>{legal.ready ? "опубліковано" : "не опубліковано"}</strong>.
                {legal.missing.length > 0 && ` Для публікації бракує: ${legal.missing.join(", ")}.`}
                {" "}Перегляньте тексти на сторінках /uk/offer і /uk/privacy після публікації; реквізити й строк зберігання — у полях нижче.</p></div>
          </fieldset>
          {F.filter(([k]) => k !== "payment_mode").map(([k, l, t]) => (
            <div key={k} className={`field ${t ? "sm:col-span-2" : ""}`}><label htmlFor={k}>{l}</label>
              {t ? <textarea id={k} name={k} rows={3} defaultValue={s[k as keyof typeof s]} className="input" /> : <input id={k} name={k} defaultValue={s[k as keyof typeof s]} className="input" />}</div>
          ))}
        </ActionForm>
      </section>
      <section className="card p-5 sm:p-6">
        <h2 className="text-2xl">Автоматичне надсилання PDF після оплати</h2>
        <p className="mt-1 text-sm text-ink-soft">Після підтвердженої оплати покупець автоматично отримує лист від авторки з PDF-книжкою у вкладенні (комплект — усі книжки) і квитанцією про оплату. Для цього потрібні пошта й завантажені PDF кожної мовної версії.</p>
        <ul className="mt-3 space-y-1 text-sm">
          <li>Пошта: <strong className={mail.provider === "none" ? "text-[#9a2f28]" : "text-plum-700"}>{mail.provider === "none" ? "не налаштована (EMAIL_PROVIDER у Vercel)" : mail.provider === "smtp" ? `Gmail/SMTP — ${mail.from}` : mail.provider === "resend" ? `Resend — ${mail.from}` : "outbox (розробка)"}</strong></li>
          <li>Відповіді покупців приходитимуть на: <strong>{s.contact_email || "— (вкажіть «Email для зв’язку» вище)"}</strong></li>
          <li>PDF завантажено: <strong>{pdfs.filter((p) => p.ok).length} з {pdfs.length}</strong>{pdfs.some((p) => !p.ok) && <span className="text-[#9a2f28]"> — бракує: {pdfs.filter((p) => !p.ok).map((p) => p.label).join("; ")}</span>}</li>
        </ul>
        <p className="mt-2 text-sm text-ink-soft">Без файлу книжки лист не надсилається автоматично: замовлення позначається «надішліть PDF вручну». PDF завантажуються на сторінці кожної книжки (Товари → книжка → «Завантажити PDF»).</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ActionForm action={storageCheckAction} submit="Перевірити сховище файлів" />
          <ActionForm action={emailTestAction} submit="Надіслати тестовий лист" />
        </div>
      </section>
      <section className="card p-5 sm:p-6">
        <h2 className="text-2xl">Фото книжок для головної (атмосферний блок)</h2>
        <p className="mt-1 text-sm text-ink-soft">Зараз: {s.books_photo === "none" ? "приховано" : s.books_photo ? "завантажено" : "немає — блок не показується"}. Поле <code>books_photo</code> у формі вище: <code>none</code> — сховати.</p>
        <UploadForm kind="books_photo" targetId="books" accept="image/jpeg,image/png,image/webp" label="Завантажити фото книжок на дерев’яному столі (JPG/PNG/WebP, до 10 МБ)" />
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
