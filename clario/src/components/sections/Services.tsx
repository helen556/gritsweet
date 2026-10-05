import slitLampExam from "@/assets/slit-lamp-exam.webp";
import type { Dictionary } from "@/content/dictionaries";
import { ParallaxImage } from "@/components/ParallaxImage";
import { BookButton } from "@/components/booking/BookingProvider";
import { ArrowIcon, ServiceIcon } from "@/components/Icon";
import { Reveal } from "@/components/motion";

export function Services({ t }: { t: Dictionary["services"] }) {
  return (
    <section id="services" aria-labelledby="services-title" className="relative overflow-hidden bg-cold-50">
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 right-[-10%] size-[42rem] rounded-full bg-ice-100/80 blur-3xl" />
      <div className="container-x section-y relative">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">{t.eyebrow}</p>
          <h2 id="services-title" className="h-section mt-6">{t.title}</h2>
        </Reveal>

        <Reveal delay={0.1} className="mt-14 lg:mt-20">
          <ParallaxImage src={slitLampExam} alt={t.imageAlt} sizes="(min-width: 1320px) 1240px, 100vw" className="aspect-[4/3] rounded-[2rem] shadow-[var(--shadow-soft)] sm:aspect-[16/9] lg:aspect-[21/9]" imageClassName="object-[50%_32%]" />
        </Reveal>

        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:mt-5 lg:grid-cols-3 lg:gap-5">
          {t.items.map((s, i) => (
            <Reveal as="li" key={s.id} delay={(i % 3) * 0.08}>
              <article className="group relative flex h-full min-h-[17rem] flex-col overflow-hidden rounded-[1.75rem] border border-white bg-white/75 p-7 shadow-[0_1px_2px_rgb(21_24_26/0.03)] backdrop-blur-xl transition-[transform,box-shadow,border-color] duration-700 ease-[var(--ease-out-expo)] hover:-translate-y-1.5 hover:border-ice-200 hover:shadow-[var(--shadow-lift)] sm:p-8">
                <div aria-hidden="true" className="pointer-events-none absolute -right-16 -bottom-20 size-56 rounded-full bg-ice-100 opacity-0 blur-2xl transition-opacity duration-700 group-hover:opacity-100" />
                <div className="relative flex items-start justify-between">
                  <span className="grid size-14 place-items-center rounded-2xl bg-ice-50 text-ice-700 ring-1 ring-ice-100 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.08]">
                    <ServiceIcon id={s.id} className="size-8" />
                  </span>
                  <span className="text-[0.75rem] font-semibold tracking-[0.12em] text-cold-400 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="relative mt-auto pt-10 text-[1.3rem] leading-snug font-medium tracking-[-0.015em]">{s.title}</h3>
                <BookButton
                  service={s.id}
                  className="mt-6 inline-flex items-center gap-2 self-start rounded-full text-[0.88rem] font-semibold text-ice-700 transition-colors duration-500 hover:text-graphite-900 after:absolute after:inset-0 after:rounded-[1.75rem]"
                >
                  {t.book}
                  <ArrowIcon className="size-4 transition-transform duration-500 group-hover:translate-x-1" />
                  <span className="sr-only">: {s.title}</span>
                </BookButton>
              </article>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
