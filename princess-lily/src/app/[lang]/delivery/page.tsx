import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, hasLocale } from "@/i18n";
import { pageMeta } from "@/lib/seo";
import InfoPage from "@/components/InfoPage";
import { effectivePaymentMode } from "@/lib/orders";
import { pdfDeliveryMode } from "@/lib/storefront";

export async function generateMetadata({ params }: PageProps<"/[lang]/delivery">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDict(lang);
  return pageMeta(lang, "/delivery", t.pages.delivery.title, t.faq.items[8].a[0]);
}
export default async function Delivery({ params }: PageProps<"/[lang]/delivery">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang);
  const d = t.pages.delivery;
  const [mode, pdf] = await Promise.all([effectivePaymentMode(), pdfDeliveryMode()]);
  const resolve = (s: string) => s === "@PDF_DELIVERY" ? (pdf === "auto" ? t.faq.pdfAuto : t.faq.pdfManual)
    : s === "@PAYMENT_MODE" ? (mode === "provider" ? d.paymentProvider : mode === "manual_link" ? d.paymentManual : d.paymentDisabled) : s;
  return (
    <InfoPage title={d.title}>
      {d.sections.map((s) => (<section key={s.h}><h2>{s.h}</h2>{s.p.map((p, i) => <p key={i}>{resolve(p)}</p>)}</section>))}
    </InfoPage>
  );
}
