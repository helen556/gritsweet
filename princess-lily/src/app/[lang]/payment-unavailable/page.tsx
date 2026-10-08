import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, hasLocale } from "@/i18n";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function PaymentUnavailable({ params }: PageProps<"/[lang]/payment-unavailable">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang);
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
      <h1 className="text-5xl text-moss-900">{t.pages.paymentUnavailable.title}</h1>
      <p className="mt-5 text-lg text-ink-soft">{t.pages.paymentUnavailable.p}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href={`/${lang}/contacts`} className="btn btn-primary">{t.nav.contacts}</Link>
        <Link href={`/${lang}/cart`} className="btn btn-ghost">{t.nav.cart}</Link>
      </div>
    </div>
  );
}
