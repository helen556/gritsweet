import Image from "next/image";
import Link from "next/link";
import blurred from "@/assets/01_blurred_clinic.png";
import { getDictionary, locales } from "@/content/dictionaries";
import { EyeMark } from "@/components/Icon";
import { btn } from "@/components/ui";

// not-found receives no params, so both languages are rendered and CSS shows the one
// matching <html lang> (set by the [lang] layout). Keeps the page fully static.
export default function NotFound() {
  return (
    <main id="main" className="on-dark relative isolate grid min-h-[100svh] place-items-center overflow-hidden bg-graphite-900 px-4 text-center text-white">
      <Image src={blurred} alt="" fill sizes="100vw" placeholder="blur" quality={92} className="-z-20 object-cover opacity-60" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgb(21_24_26/0.55),rgb(21_24_26/0.9))]" />
      {locales.map((lang) => {
        const t = getDictionary(lang).notFound;
        return (
          <div key={lang} lang={lang} className={`max-w-xl ${lang === "en" ? "hidden [html[lang=en]_&]:block" : "[html[lang=en]_&]:hidden"}`}>
            <EyeMark className="mx-auto w-14 text-ice-200" />
            <p className="mt-10 text-[clamp(5rem,16vw,9rem)] leading-none font-extralight tracking-[-0.05em] text-white/90">{t.code}</p>
            <h1 className="mt-6 text-3xl font-light">{t.title}</h1>
            <p className="mt-4 text-white/75">{t.text}</p>
            <Link href={lang === "en" ? "/en" : "/"} className={`${btn.primaryLight} mt-10 h-14 px-9`}>
              {t.back}
            </Link>
          </div>
        );
      })}
    </main>
  );
}
