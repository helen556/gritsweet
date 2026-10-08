import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, hasLocale } from "@/i18n";
import InfoPage from "@/components/InfoPage";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const { lang } = await params;
  return { title: getDict(hasLocale(lang) ? lang : "uk").pages.privacy.title, robots: { index: false, follow: true } };
}

/** ЧЕРНЕТКА: не індексується до погодження власницею та заповнення реквізитів. */
export default async function Privacy({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang);
  return (
    <InfoPage title={t.pages.privacy.title} draft={t.pages.draftBanner}>
      {lang === "uk" ? (<>
        <h2>1. Хто обробляє дані</h2><p>[Найменування / ПІБ продавця, ІПН/ЄДРПОУ, адреса, контактний email — заповнити].</p>
        <h2>2. Які дані ми збираємо</h2><ul><li>Email та ім’я — для оформлення замовлення та надсилання електронної книжки.</li><li>Телефон, місто та відділення/поштомат Нової пошти — лише для друкованих замовлень.</li><li>Звернення через контактну форму.</li></ul>
        <h2>3. Мета обробки</h2><p>Виконання замовлення, доставка, підтримка покупців, виконання вимог законодавства.</p>
        <h2>4. Кому передаються дані</h2><p>[Платіжний сервіс — вказати], [email-сервіс — вказати], ТОВ «Нова Пошта» (для друкованих замовлень). Дані не продаються третім особам.</p>
        <h2>5. Аналітика та cookie</h2><p>Сайт не використовує рекламні cookie. [Якщо підключено аналітику без персональних даних — вказати сервіс].</p>
        <h2>6. Строк зберігання</h2><p>[Вказати строк зберігання даних замовлень].</p>
        <h2>7. Ваші права</h2><p>Ви можете запросити доступ, виправлення чи видалення своїх даних, написавши на [email].</p>
      </>) : (<>
        <h2>1. Data controller</h2><p>[Seller’s name, tax ID, address, contact email — to be completed].</p>
        <h2>2. Data we collect</h2><ul><li>Email and name — to process your order and send your digital book.</li><li>Phone, city and Nova Poshta branch/locker — for printed orders only.</li><li>Messages sent via the contact form.</li></ul>
        <h2>3. Purpose</h2><p>Order fulfilment, delivery, customer support, legal compliance.</p>
        <h2>4. Recipients</h2><p>[Payment provider — to specify], [email service — to specify], Nova Poshta (printed orders). Data is never sold.</p>
        <h2>5. Analytics and cookies</h2><p>The site uses no advertising cookies. [If cookie-less analytics is enabled — name the service].</p>
        <h2>6. Retention</h2><p>[Specify retention period for order data].</p>
        <h2>7. Your rights</h2><p>You may request access, correction or deletion of your data by writing to [email].</p>
      </>)}
    </InfoPage>
  );
}
