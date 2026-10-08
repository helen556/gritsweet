import { getSettings } from "@/lib/settings";
import type { Dict } from "@/i18n";

/** Контакти з налаштувань адмінки. Якщо не заповнено — чесна позначка, без вигаданих даних. */
export default async function ContactDetails({ t, compact = false }: { lang: "uk" | "en"; t: Dict; compact?: boolean }) {
  const s = await getSettings();
  const items = [
    s.contact_email && { label: "Email", href: `mailto:${s.contact_email}`, text: s.contact_email },
    s.contact_phone && { label: "Tel", href: `tel:${s.contact_phone.replace(/[^+\d]/g, "")}`, text: s.contact_phone },
    s.contact_instagram && { label: "Instagram", href: s.contact_instagram.startsWith("http") ? s.contact_instagram : `https://instagram.com/${s.contact_instagram.replace(/^@/, "")}`, text: s.contact_instagram },
    s.contact_telegram && { label: "Telegram", href: s.contact_telegram.startsWith("http") ? s.contact_telegram : `https://t.me/${s.contact_telegram.replace(/^@/, "")}`, text: s.contact_telegram },
  ].filter(Boolean) as { label: string; href: string; text: string }[];
  if (!items.length) return compact ? null : <p className="text-ink-soft">{t.contact.notSet}</p>;
  return (
    <ul className={`flex flex-wrap gap-x-6 gap-y-1 ${compact ? "mt-4" : ""}`}>
      {items.map((i) => (
        <li key={i.label}><span className="text-ink-soft">{i.label}: </span><a className="inline-flex min-h-11 items-center font-semibold text-moss-900 underline decoration-gold underline-offset-4" href={i.href} rel="noopener">{i.text}</a></li>
      ))}
    </ul>
  );
}
