import type { Dictionary } from "@/content/dictionaries";
import { BookButton } from "@/components/booking/BookingProvider";
import { Reveal } from "@/components/motion";
import { btn } from "@/components/ui";

export function Prices({ t, cta }: { t: Dictionary["prices"]; cta: string }) {
  return (
    <section id="prices" aria-labelledby="prices-title" className="bg-white">
      <div className="container-x section-y grid gap-12 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-4">
          <p className="eyebrow">{t.eyebrow}</p>
          <h2 id="prices-title" className="h-section mt-6">{t.title}</h2>
          <div className="mt-10 hidden lg:block">
            <BookButton className={`${btn.primary} h-14 px-9`}>{cta}</BookButton>
          </div>
        </Reveal>
        <div className="lg:col-span-8">
          <ul className="overflow-hidden rounded-[1.75rem] border border-graphite-800/8 bg-cold-50/60">
            {t.items.map((p, i) => (
              <Reveal
                as="li"
                key={p.title}
                delay={0.05 * i}
                className="group flex flex-col gap-1 border-b border-graphite-800/8 px-6 py-6 transition-colors duration-500 last:border-b-0 hover:bg-white sm:flex-row sm:items-baseline sm:gap-6 sm:px-8 sm:py-7"
              >
                  <span className="text-[1.08rem] font-medium text-graphite-800">{p.title}</span>
                  <span aria-hidden="true" className="hidden h-px flex-1 translate-y-[-0.3em] bg-[repeating-linear-gradient(90deg,var(--color-cold-300)_0_2px,transparent_2px_7px)] opacity-70 sm:block" />
                  <span className="text-[1.25rem] font-light tracking-[-0.01em] whitespace-nowrap text-graphite-900 tabular-nums">{p.price}</span>
              </Reveal>
            ))}
          </ul>
          <div className="mt-8 lg:hidden">
            <BookButton className={`${btn.primary} h-14 w-full px-9 sm:w-auto`}>{cta}</BookButton>
          </div>
        </div>
      </div>
    </section>
  );
}
