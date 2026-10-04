import type { Dictionary, Locale } from "@/content/dictionaries";
import { EyeMark } from "@/components/Icon";

type Props = { t: Pick<Dictionary, "nav" | "contacts" | "footer" | "ui">; lang: Locale };

export function Footer({ t, lang }: Props) {
  const year = new Date().getFullYear();
  const base = lang === "uk" ? "/" : "/en";
  return (
    <footer className="on-dark bg-graphite-950 text-cold-400">
      <div className="container-x grid gap-12 pt-20 pb-10 md:grid-cols-12">
        <div className="md:col-span-5">
          <a href={lang === "uk" ? "/" : "/en"} aria-label={t.ui.home} className="inline-flex items-center gap-3 text-white">
            <EyeMark className="w-10" />
            <span className="flex flex-col leading-none">
              <span className="text-[1.15rem] font-semibold">Clario</span>
              <span className="mt-1 text-[0.6rem] font-medium tracking-[0.24em] text-cold-400 uppercase">Vision Clinic</span>
            </span>
          </a>
        </div>
        <nav aria-label={t.ui.primaryNav} className="md:col-span-3">
          <ul className="grid gap-2.5">
            {t.nav.map((n) => (
              <li key={n.href}>
                <a href={`${base}${n.href}`} className="transition-colors duration-300 hover:text-white">{n.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="grid gap-2.5 md:col-span-4">
          <span>{t.contacts.address}</span>
          <a href={t.contacts.phoneHref} className="transition-colors duration-300 hover:text-white">{t.contacts.phone}</a>
          <a href={`mailto:${t.contacts.email}`} className="transition-colors duration-300 hover:text-white">{t.contacts.email}</a>
          <span>{t.contacts.hours}</span>
        </div>
      </div>
      <div className="container-x flex flex-col gap-2 border-t border-white/8 py-8 text-[0.82rem] text-cold-500 sm:flex-row sm:justify-between">
        <span>© {year} Clario Vision Clinic. {t.footer.rights}</span>
      </div>
    </footer>
  );
}
