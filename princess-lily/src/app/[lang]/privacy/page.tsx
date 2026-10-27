import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, hasLocale } from "@/i18n";
import InfoPage from "@/components/InfoPage";
import ContactDetails from "@/components/ContactDetails";
import { legalStatus } from "@/lib/legal";
import { effectivePaymentMode } from "@/lib/orders";
import { emailConfig } from "@/lib/config";
import { metaPixelId } from "@/lib/tracking";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const { ready } = await legalStatus();
  const t = getDict(lang);
  return { ...pageMeta(lang, "/privacy", t.pages.privacy.title, t.seo.orgDescription, { noindex: !ready }), robots: { index: ready, follow: true } };
}

/**
 * Політика конфіденційності. Публікується лише після погодження власницею (див. src/lib/legal.ts).
 * Перелік сервісів формується з фактично ввімкнених інтеграцій — нічого не вигадано.
 */
export default async function Privacy({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang);
  const { ready, settings: s } = await legalStatus();
  if (!ready) return <InfoPage title={t.pages.privacy.title} note={<><p>{t.pages.legalPending}</p><ContactDetails lang={lang} t={t} compact /></>} />;
  const uk = lang === "uk";
  const pay = (await effectivePaymentMode()) !== "disabled";
  const mail = emailConfig().provider === "resend";
  const pixel = !!metaPixelId();
  const plausible = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER === "plausible" && !!process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN;
  const seller = uk ? s.seller_details_uk : s.seller_details_en;
  const recipients = [
    pay && (uk ? "платіжний сервіс monobank — для оплати замовлення" : "monobank payment service — to process your payment"),
    mail && (uk ? "сервіс розсилки Resend — для листів із замовленням" : "Resend email service — to send order emails"),
    uk ? "ТОВ «Нова Пошта» — лише для друкованих замовлень" : "Nova Poshta — for printed orders only",
    pixel && (uk ? "Meta Platforms (Meta Pixel) — лише за вашою згодою на рекламні cookie" : "Meta Platforms (Meta Pixel) — only with your consent to advertising cookies"),
  ].filter(Boolean) as string[];
  return (
    <InfoPage title={t.pages.privacy.title}>
      {uk ? (<>
        <h2>1. Хто обробляє дані</h2><p>{seller.split(/\n+/).map((l, i) => <span key={i} className="block">{l}</span>)}</p><p>Email: {s.contact_email}</p>
        <h2>2. Які дані ми збираємо</h2><ul><li>Email, ім’я та прізвище — для оформлення замовлення й надсилання електронної книжки.</li><li>Нік або номер у Telegram — якщо ви обрали отримання PDF у Telegram.</li><li>Телефон, населений пункт і відділення чи поштомат Нової пошти — лише для друкованих замовлень (а також дані отримувача, якщо це інша людина).</li><li>Квитанція про оплату — якщо ви її завантажили.</li><li>Звернення через контактну форму.</li></ul>
        <h2>3. Мета обробки</h2><p>Виконання замовлення, доставка, підтримка покупців, виконання вимог законодавства.</p>
        <h2>4. Кому передаються дані</h2><ul>{recipients.map((r) => <li key={r}>{r}</li>)}</ul><p>Дані не продаються третім особам.</p>
        <h2>5. Cookie та аналітика</h2><p>Кошик зберігається лише у вашому браузері.{plausible ? " Для статистики відвідувань використовується Plausible — без cookie й персональних даних." : ""}{pixel ? " Рекламний піксель Meta вмикається лише після вашої згоди; змінити рішення можна кнопкою «Налаштування cookie» внизу сторінки." : " Рекламні трекери не використовуються."}</p>
        <h2>6. Строк зберігання</h2><p>{s.legal_retention_uk}</p>
        <h2>7. Ваші права</h2><p>Ви можете запросити доступ до своїх даних, їх виправлення чи видалення, написавши на {s.contact_email}.</p>
      </>) : (<>
        <h2>1. Data controller</h2><p>{seller.split(/\n+/).map((l, i) => <span key={i} className="block">{l}</span>)}</p><p>Email: {s.contact_email}</p>
        <h2>2. Data we collect</h2><ul><li>Email, first and last name — to process your order and send your digital book.</li><li>Telegram username or number — if you chose to receive the PDF on Telegram.</li><li>Phone, city and Nova Poshta branch or locker — for printed orders only (plus the recipient’s details if it is someone else).</li><li>Your payment receipt — if you uploaded it.</li><li>Messages sent via the contact form.</li></ul>
        <h2>3. Purpose</h2><p>Order fulfilment, delivery, customer support and legal compliance.</p>
        <h2>4. Recipients</h2><ul>{recipients.map((r) => <li key={r}>{r}</li>)}</ul><p>We never sell your data.</p>
        <h2>5. Cookies and analytics</h2><p>Your cart is stored only in your browser.{plausible ? " Visit statistics use Plausible, which sets no cookies and collects no personal data." : ""}{pixel ? " The Meta advertising pixel is enabled only after you consent; you can change your choice with the “Cookie settings” button at the bottom of the page." : " No advertising trackers are used."}</p>
        <h2>6. Retention</h2><p>{s.legal_retention_en}</p>
        <h2>7. Your rights</h2><p>You may request access to, correction or deletion of your data by writing to {s.contact_email}.</p>
      </>)}
    </InfoPage>
  );
}
