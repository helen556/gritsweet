import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, hasLocale } from "@/i18n";
import CartView from "@/components/cart/CartView";

export async function generateMetadata({ params }: PageProps<"/[lang]/cart">): Promise<Metadata> {
  const { lang } = await params;
  return { title: getDict(hasLocale(lang) ? lang : "uk").cart.title, robots: { index: false, follow: false } };
}
export default async function CartPage({ params }: PageProps<"/[lang]/cart">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-5xl text-moss-900">{t.cart.title}</h1>
      <CartView lang={lang} t={{ cart: t.cart, formats: t.formats, bookLocales: t.bookLocales }} />
    </div>
  );
}
