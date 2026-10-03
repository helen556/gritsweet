import Link from "next/link";
import { StormHero } from "@/components/hero/StormHero";
import { SiteFooter, SiteHeader } from "@/components/ui/SiteChrome";

/** Сторінки з текстом: той самий фон (без руху), читабельна колонка. */
export function ContentPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <StormHero scene="calm" still />
      <SiteHeader />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <main className="safe-px mx-auto w-full max-w-2xl flex-1 pb-16 pt-28">
          <h1 className="font-display text-title font-medium text-frost">{title}</h1>
          <div className="mt-8 space-y-5 text-[1.0625rem] leading-relaxed text-frost/85 [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-frost [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
            {children}
          </div>
          <p className="mt-12">
            <Link href="/" className="inline-flex min-h-11 items-center text-mist underline-offset-4 hover:text-frost hover:underline">
              ← На головну
            </Link>
          </p>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
