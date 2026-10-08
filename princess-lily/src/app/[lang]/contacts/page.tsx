import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, hasLocale } from "@/i18n";
import { pageMeta } from "@/lib/seo";
import ContactForm from "@/components/ContactForm";
import ContactDetails from "@/components/ContactDetails";

export async function generateMetadata({ params }: PageProps<"/[lang]/contacts">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDict(lang);
  return pageMeta(lang, "/contacts", t.contact.title, t.contact.intro);
}
export default async function Contacts({ params }: PageProps<"/[lang]/contacts">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-5xl text-moss-900">{t.contact.title}</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">{t.contact.intro}</p>
      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <ContactForm lang={lang} t={t.contact} />
        <aside className="card self-start p-6">
          <h2 className="text-2xl text-moss-900">{t.contact.direct}</h2>
          <div className="mt-3"><ContactDetails lang={lang} t={t} /></div>
        </aside>
      </div>
    </div>
  );
}
