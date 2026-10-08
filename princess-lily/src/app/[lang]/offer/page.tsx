import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, hasLocale } from "@/i18n";
import InfoPage from "@/components/InfoPage";

export async function generateMetadata({ params }: PageProps<"/[lang]/offer">): Promise<Metadata> {
  const { lang } = await params;
  return { title: getDict(hasLocale(lang) ? lang : "uk").pages.offer.title, robots: { index: false, follow: true } };
}

/** ЧЕРНЕТКА договору публічної оферти — потребує юридичної перевірки та реквізитів продавця. */
export default async function Offer({ params }: PageProps<"/[lang]/offer">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang);
  return (
    <InfoPage title={t.pages.offer.title} draft={t.pages.draftBanner}>
      {lang === "uk" ? (<>
        <h2>1. Продавець</h2><p>[Найменування / ПІБ ФОП, ІПН, адреса, банківські реквізити — заповнити].</p>
        <h2>2. Предмет</h2><p>Продаж електронних (PDF) та друкованих книжок серії «Історії принцеси Лілі» через сайт.</p>
        <h2>3. Ціна та оплата</h2><p>Ціни вказані на сторінках книжок у гривнях. Доставку друкованих книжок оплачує покупець за тарифами Нової пошти. [Спосіб оплати — вказати].</p>
        <h2>4. Електронні книжки</h2><p>Електронна книга призначена для особистого використання. Ви можете роздрукувати придбаний PDF-файл для читання зі своєю дитиною. Копіювання з метою продажу, поширення файлу або його публікація без дозволу автора заборонені.</p>
        <h2>5. Доставка</h2><p>Плановий термін відправлення — протягом 1–3 робочих днів після оплати, Новою поштою по Україні.</p>
        <h2>6. Повернення</h2><p>Відповідно до розділу «Повернення та обмін» і чинного законодавства України. [Уточнити].</p>
      </>) : (<>
        <h2>1. Seller</h2><p>[Seller’s name, tax ID, address, bank details — to be completed].</p>
        <h2>2. Subject</h2><p>Sale of digital (PDF) and printed books of the Princess Lily Stories series via this website.</p>
        <h2>3. Price and payment</h2><p>Prices are shown on book pages in UAH. Shipping for printed books is paid by the customer at Nova Poshta rates. [Payment method — to specify].</p>
        <h2>4. Digital books</h2><p>Our digital books are intended for personal use. You may print your purchased PDF for reading with your child. Reselling, distributing, or publishing the file without the author’s permission is prohibited.</p>
        <h2>5. Delivery</h2><p>Planned dispatch within 1–3 business days after payment, via Nova Poshta within Ukraine.</p>
        <h2>6. Returns</h2><p>See Returns &amp; exchanges and applicable Ukrainian law. [To be specified].</p>
      </>)}
    </InfoPage>
  );
}
