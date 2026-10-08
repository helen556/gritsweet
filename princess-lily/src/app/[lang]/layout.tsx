import "../globals.css";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDict, hasLocale, LOCALES } from "@/i18n";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CartProvider } from "@/components/cart/CartProvider";
import CursorTrail from "@/components/effects/CursorTrail";
import MotionEnhancer from "@/components/effects/MotionEnhancer";
import Analytics from "@/components/Analytics";
import { siteUrl } from "@/lib/seo";

export const generateStaticParams = () => LOCALES.map((lang) => ({ lang }));
export const dynamicParams = false;
// Каталог і налаштування змінюються в адмінці — рендеримо на запит, без застиглих даних збірки
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const t = getDict(hasLocale(lang) ? lang : "uk");
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t.meta.homeTitle, template: `%s · ${t.meta.siteName}` },
    description: t.meta.homeDescription,
  };
}
export const viewport: Viewport = { themeColor: "#faf6ee", width: "device-width", initialScale: 1 };

// До першого малювання: клас js (для поступової появи) і intro-play лише для першого входу за сесію
const bootScript = `(function(){var d=document.documentElement;d.classList.add('js');try{if(sessionStorage.getItem('pl_intro_seen')!=='1'&&!matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('intro-play')}catch(e){}})();`;

export default async function LangLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang);
  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        {/* Має виконатися до першого малювання (тому не next/script) */}
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <a href="#main" className="skip-link">{t.nav.skip}</a>
        <CartProvider>
          <Suspense fallback={<div className="h-16" />}>
            <Header lang={lang} t={{ nav: t.nav, brand: t.brand }} />
          </Suspense>
          <main id="main" tabIndex={-1} className="outline-none">{children}</main>
          <Footer lang={lang} t={t} />
        </CartProvider>
        <CursorTrail />
        <MotionEnhancer />
        <Analytics />
      </body>
    </html>
  );
}
