import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { notFound } from "next/navigation";
import { MotionConfig } from "framer-motion";
import "../globals.css";
import { getDictionary, isLocale, localePath, locales, siteUrl } from "@/content/dictionaries";
import { BookingProvider } from "@/components/booking/BookingProvider";
import { Cursor } from "@/components/Cursor";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
  display: "swap",
});

export const dynamicParams = false;
export const generateStaticParams = () => locales.map((lang) => ({ lang }));

export const viewport: Viewport = {
  themeColor: "#1b1e21",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang);
  return {
    metadataBase: new URL(siteUrl),
    title: t.meta.title,
    description: t.meta.description,
    applicationName: "Clario Vision Clinic",
    alternates: {
      canonical: localePath(lang),
      languages: { uk: "/", en: "/en", "x-default": "/" },
    },
    openGraph: {
      type: "website",
      siteName: "Clario Vision Clinic",
      title: t.meta.title,
      description: t.meta.description,
      url: localePath(lang),
      locale: t.meta.ogLocale,
      alternateLocale: lang === "uk" ? ["en_US"] : ["uk_UA"],
      images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Clario Vision Clinic" }],
    },
    twitter: {
      card: "summary_large_image",
      title: t.meta.title,
      description: t.meta.description,
      images: ["/og.jpg"],
    },
    robots: { index: true, follow: true },
    formatDetection: { telephone: false },
  };
}

export default async function LangLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);

  return (
    <html lang={lang} className={manrope.variable} data-scroll-behavior="smooth">
      <body className="min-h-dvh font-sans">
        <a href="#main" className="sr-only z-[90] rounded-full bg-white px-5 py-3 font-semibold text-graphite-900 shadow-[var(--shadow-lift)] focus:not-sr-only focus:fixed focus:top-4 focus:left-4">
          {t.ui.skip}
        </a>
        <MotionConfig reducedMotion="user">
          <BookingProvider t={t.booking} services={t.services.items} closeLabel={t.ui.close} lang={lang}>
            <Header t={{ nav: t.nav, ui: t.ui, cta: t.cta }} lang={lang} />
            {children}
            <Footer t={{ nav: t.nav, contacts: t.contacts, footer: t.footer, ui: t.ui }} lang={lang} />
          </BookingProvider>
          <Cursor />
        </MotionConfig>
      </body>
    </html>
  );
}
