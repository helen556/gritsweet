import Link from "next/link";
import type { Dict } from "@/i18n";

export function resolveLine(line: string, lang: "uk" | "en", t: Dict, pdfMode: "auto" | "manual") {
  if (line === "@PDF_DELIVERY") return pdfMode === "auto" ? t.faq.pdfAuto : t.faq.pdfManual;
  if (line === "@RETURNS_LINK") {
    const label = lang === "uk" ? "«Повернення та обмін»" : "Returns and Exchanges";
    const [before, after] = t.faq.returnsLink.split(label);
    return <>{before}<Link href={`/${lang}/returns`} className="underline decoration-gold underline-offset-4 hover:text-moss-900">{label}</Link>{after}</>;
  }
  return line;
}

export default function Faq({ lang, t, pdfMode }: { lang: "uk" | "en"; t: Dict; pdfMode: "auto" | "manual" }) {
  return (
    <div className="surface divide-y divide-black/[.06] overflow-hidden">
      {t.faq.items.map((item, i) => (
        <details key={i} className="faq group" id={`faq-${i + 1}`}>
          <summary className="flex min-h-14 items-center gap-4 px-5 py-4 text-left text-[1.05rem] font-semibold transition-colors hover:bg-moss-100/50 sm:px-7">
            <span className="w-7 shrink-0 font-display text-lg text-copper">{i + 1}.</span>
            <span className="flex-1">{item.q}</span>
            <svg className="faq-icon shrink-0 text-moss-700" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </summary>
          <div className="prose-soft px-5 pb-6 pl-[4.25rem] text-ink-soft sm:px-7 sm:pl-[4.75rem]">
            {item.a.map((line, j) => <p key={j}>{resolveLine(line, lang, t, pdfMode)}</p>)}
          </div>
        </details>
      ))}
    </div>
  );
}
