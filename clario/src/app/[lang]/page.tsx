import { notFound } from "next/navigation";
import { getDictionary, isLocale, localePath, siteUrl } from "@/content/dictionaries";
import { Hero } from "@/components/sections/Hero";
import { About } from "@/components/sections/About";
import { Services } from "@/components/sections/Services";
import { Doctors } from "@/components/sections/Doctors";
import { Technology } from "@/components/sections/Technology";
import { Prices } from "@/components/sections/Prices";
import { Reviews } from "@/components/sections/Reviews";
import { Faq } from "@/components/sections/Faq";
import { BookingSection } from "@/components/sections/BookingSection";
import { Contacts } from "@/components/sections/Contacts";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    name: "Clario Vision Clinic",
    description: t.meta.description,
    url: `${siteUrl}${localePath(lang) === "/" ? "" : localePath(lang)}`,
    image: `${siteUrl}/og.jpg`,
    telephone: "+380441234567",
    email: t.contacts.email,
    medicalSpecialty: "Optometric",
    address: {
      "@type": "PostalAddress",
      streetAddress: lang === "uk" ? "вул. Антоновича, 24" : "24 Antonovycha St",
      addressLocality: lang === "uk" ? "Київ" : "Kyiv",
      addressCountry: "UA",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        opens: "09:00",
        closes: "19:00",
      },
    ],
    availableService: t.services.items.map((s) => ({ "@type": "MedicalProcedure", name: s.title })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <main id="main">
        <Hero t={t.hero} cta={t.cta} scrollLabel={t.ui.scroll} />
        <About t={t.about} />
        <Services t={t.services} />
        <Doctors t={t.doctors} />
        <div className="px-2 sm:px-3">
          <Technology t={t.technology} />
        </div>
        <Prices t={t.prices} cta={t.cta.primary} />
        <Reviews t={t.reviews} />
        <Faq t={t.faq} />
        <div className="px-2 sm:px-3">
          <BookingSection t={t.booking} services={t.services.items} contacts={t.contacts} lang={lang} />
        </div>
        <Contacts t={t.contacts} />
      </main>
    </>
  );
}
