import Link from "next/link";
import type { Dict } from "@/i18n";

export default function Footer({ lang, t }: { lang: "uk" | "en"; t: Dict }) {
  const f = t.footer.links;
  return (
    <footer className="relative mt-16 bg-[linear-gradient(180deg,rgba(242,234,219,0),rgba(242,234,219,.75)_35%,#efe7d6)]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="font-display text-2xl font-semibold text-moss-900">{t.brand.name}</p>
          <p className="mt-1 text-ink-soft">{t.brand.slogan}</p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {([["delivery", f.delivery], ["returns", f.returns], ["contacts", f.contacts], ["privacy", f.privacy], ["offer", f.offer]] as const).map(([p, l]) => (
              <li key={p}><Link href={`/${lang}/${p}`} className="inline-flex min-h-11 items-center text-ink-soft underline-offset-4 hover:text-moss-900 hover:underline">{l}</Link></li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-8 text-sm text-ink-soft sm:px-6">© {new Date().getFullYear()} {t.footer.rights}. {t.footer.illustrations}</div>
    </footer>
  );
}
