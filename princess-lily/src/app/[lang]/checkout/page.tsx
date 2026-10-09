import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getDict, hasLocale } from "@/i18n";
import { effectivePaymentMode } from "@/lib/orders";
import { novaPoshtaMode } from "@/lib/delivery/nova-poshta";
import CheckoutForm from "@/components/cart/CheckoutForm";

export async function generateMetadata({ params }: PageProps<"/[lang]/checkout">): Promise<Metadata> {
  const { lang } = await params;
  return { title: getDict(hasLocale(lang) ? lang : "uk").checkout.title, robots: { index: false, follow: false } };
}
export default async function Checkout({ params, searchParams }: PageProps<"/[lang]/checkout">) {
  const { lang } = await params;
  // «Купити зараз»: ?buy=<variantId>&qty=N — оформлюється лише ця позиція, кошик не використовується
  const sp = await searchParams;
  const buy = typeof sp.buy === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(sp.buy) ? sp.buy : null;
  const qty = Math.max(1, Math.min(10, Number(sp.qty) || 1));
  const direct = buy ? [{ variantId: buy, quantity: qty }] : null;
  if (!hasLocale(lang)) notFound();
  if ((await effectivePaymentMode()) === "disabled") redirect(`/${lang}/payment-unavailable`);
  const t = getDict(lang);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-5xl text-moss-900">{t.checkout.title}</h1>
      <CheckoutForm lang={lang} direct={direct} npMode={novaPoshtaMode()} t={{ checkout: t.checkout, cart: t.cart, formats: t.formats, bookLocales: t.bookLocales }} />
    </div>
  );
}
