import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { db } from "@/db";
import { ActionForm } from "@/components/admin/ActionForm";
import { changePassword, saveSettings } from "../actions";

export default async function SettingsPage() {
  await requireAdmin();
  const s = await getSettings();
  const photos = await db.selectFrom("photos").select(["path", "alt"]).orderBy("created_at", "desc").execute();
  return (
    <div className="grid gap-5">
      <h1 className="text-3xl">Тексти та налаштування</h1>
      <ActionForm action={saveSettings} submitLabel="Зберегти контакти" className="card p-5">
        <h2 className="text-2xl">Контакти</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label>Телефон (формат +380…)<input name="phone" defaultValue={s.phone} className="field mt-1" /></label>
          <label>Instagram (посилання)<input name="instagram_url" defaultValue={s.instagram_url} className="field mt-1" /></label>
          <label>Місто<input name="city" defaultValue={s.city} className="field mt-1" /></label>
        </div>
      </ActionForm>
      <ActionForm action={saveSettings} submitLabel="Зберегти тексти" className="card p-5">
        <h2 className="text-2xl">Основні тексти сайту</h2>
        <div className="mt-3 grid gap-3">
          <label>Заголовок першого екрана<input name="hero_title" defaultValue={s.hero_title} className="field mt-1" /></label>
          <label>Підзаголовок<input name="hero_subtitle" defaultValue={s.hero_subtitle} className="field mt-1" /></label>
          <label>Текст «Про мене» (підпис «Ваша Дар’я» додається автоматично)<textarea name="about_text" defaultValue={s.about_text} className="field mt-1 min-h-64" /></label>
          <label>Фото «Про мене»<select name="about_photo" defaultValue={s.about_photo} className="field mt-1"><option value="">Ще не додано (спершу завантажте у «Фото»)</option>{photos.map((p) => <option key={p.path} value={p.path}>{p.alt || p.path}</option>)}</select></label>
          <label>Умови замовлення<textarea name="order_terms" defaultValue={s.order_terms} className="field mt-1 min-h-40" /></label>
          <label>Часті запитання (JSON: список {"{"}&quot;q&quot;, &quot;a&quot;{"}"})<textarea name="faq" defaultValue={JSON.stringify(JSON.parse(s.faq || "[]"), null, 2)} className="field mt-1 min-h-40 font-mono text-sm" /></label>
        </div>
      </ActionForm>
      <ActionForm action={saveSettings} submitLabel="Зберегти правила" className="card p-5">
        <h2 className="text-2xl">Правила замовлення</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label>Рекомендований термін замовлення, днів<input name="lead_days" inputMode="numeric" defaultValue={s.lead_days} className="field mt-1" /></label>
          <label>Мінімальна партія капкейків, шт<input name="cupcake_min_batch" inputMode="numeric" defaultValue={s.cupcake_min_batch} className="field mt-1" placeholder="не встановлено" /></label>
        </div>
      </ActionForm>
      <ActionForm action={changePassword} submitLabel="Змінити пароль" className="card p-5">
        <h2 className="text-2xl">Пароль</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label>Поточний<input type="password" name="current" autoComplete="current-password" className="field mt-1" /></label>
          <label>Новий (≥ 10 символів)<input type="password" name="next" autoComplete="new-password" className="field mt-1" /></label>
        </div>
      </ActionForm>
      <section className="card p-5 text-sm">
        <h2 className="text-2xl">Статус інтеграцій</h2>
        <ul className="mt-2 list-disc pl-5 text-muted">
          <li>Повідомлення клієнтам (SMS/Telegram/email): не підключено — зв’язок вручну.</li>
          <li>Відновлення пароля через email: не підключено — посилання створюється командою на сервері.</li>
          <li>Онлайн-оплата: не реалізовано.</li>
        </ul>
      </section>
    </div>
  );
}
