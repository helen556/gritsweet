import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, hasLocale } from "@/i18n";
import InfoPage from "@/components/InfoPage";
import ContactDetails from "@/components/ContactDetails";
import { legalStatus } from "@/lib/legal";
import { effectivePaymentMode } from "@/lib/orders";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/offer">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const { ready } = await legalStatus();
  const t = getDict(lang);
  return { ...pageMeta(lang, "/offer", t.pages.offer.title, t.seo.orgDescription, { noindex: !ready }), robots: { index: ready, follow: true } };
}

/**
 * Договір публічної оферти. Повний текст — лише після погодження власницею й заповнення реквізитів
 * (адмінка → Налаштування); до того — примітка без чернетки. Юридичні умови тут не вигадуються:
 * текст повторює лише те, що вже діє на сайті (ціни, оплата, доставка, повернення).
 */
export default async function Offer({ params }: PageProps<"/[lang]/offer">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang);
  const { ready, settings: s } = await legalStatus();
  if (!ready) return <InfoPage title={t.pages.offer.title} note={<><p>{t.pages.legalPending}</p><ContactDetails lang={lang} t={t} compact /></>} />;
  const mode = await effectivePaymentMode();
  const seller = lang === "uk" ? s.seller_details_uk : s.seller_details_en;
  const lines = (x: string) => x.split(/\n+/).map((l, i) => <span key={i} className="block">{l}</span>);
  return (
    <InfoPage title={t.pages.offer.title}>
      {lang === "uk" ? (<>
        <h2>1. Продавець</h2><p>{lines(seller)}</p><p>Email: {s.contact_email}</p>
        <h2>2. Предмет</h2><p>Продаж електронних (PDF) і друкованих книжок серії «Історії принцеси Лілі» через сайт.</p>
        <h2>3. Ціна та оплата</h2><p>Ціни вказано на сторінках книжок у гривнях. Доставку друкованих книжок оплачує покупець за тарифами Нової пошти.</p>
        <p>{mode === "provider" ? "Оплата здійснюється онлайн через платіжний сервіс; замовлення підтверджується після повідомлення платіжного сервісу про успішну оплату." : "Оплата здійснюється за платіжним посиланням; замовлення підтверджується після того, як продавець звірить надходження коштів."}</p>
        <h2>4. Електронні книжки</h2><p>Після підтвердження оплати PDF-файл надсилається на email або в Telegram — як обрав покупець під час оформлення. Електронна книжка призначена для особистого використання: її можна роздрукувати, щоб читати зі своєю дитиною. Продавати, поширювати чи публікувати файл без дозволу авторки заборонено.</p>
        <h2>5. Доставка</h2><p>Плановий термін відправлення — 1–3 робочі дні після оплати, Новою поштою по Україні.</p>
        <h2>6. Повернення та обмін</h2><p>Відповідно до розділу <Link className="underline" href={`/${lang}/returns`}>«Повернення та обмін»</Link> і чинного законодавства України.</p>
      </>) : (<>
        <h2>1. Seller</h2><p>{lines(seller)}</p><p>Email: {s.contact_email}</p>
        <h2>2. Subject</h2><p>Sale of digital (PDF) and printed books of the Princess Lily Stories series via this website.</p>
        <h2>3. Price and payment</h2><p>Prices are shown on book pages in UAH. Shipping for printed books is paid by the customer at Nova Poshta rates.</p>
        <p>{mode === "provider" ? "Payment is made online through a payment provider; the order is confirmed once the provider notifies us that the payment succeeded." : "Payment is made via a payment link; the order is confirmed once the seller has verified the payment."}</p>
        <h2>4. Digital books</h2><p>Once the payment is confirmed, the PDF is sent by email or on Telegram, as chosen at checkout. Digital books are for personal use: you may print the file to read with your child. Reselling, distributing or publishing the file without the author’s permission is not allowed.</p>
        <h2>5. Delivery</h2><p>Planned dispatch within 1–3 business days after payment, via Nova Poshta within Ukraine.</p>
        <h2>6. Returns and exchanges</h2><p>See <Link className="underline" href={`/${lang}/returns`}>Returns &amp; exchanges</Link> and applicable Ukrainian law.</p>
      </>)}
    </InfoPage>
  );
}
