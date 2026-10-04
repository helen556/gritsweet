import slitLamp from "@/assets/02_slit_lamp_closeup.png";
import eyeMacro from "@/assets/03_eye_exam_macro.png";
import type { Dictionary } from "@/content/dictionaries";
import { ParallaxImage } from "@/components/ParallaxImage";
import { Reveal } from "@/components/motion";

export function Technology({ t }: { t: Dictionary["technology"] }) {
  return (
    <section id="technology" aria-labelledby="technology-title" className="on-dark relative overflow-hidden rounded-[2rem] bg-graphite-900 text-white sm:rounded-[2.5rem]">
      <div aria-hidden="true" className="pointer-events-none absolute top-1/3 -left-40 size-[36rem] rounded-full bg-ice-600/20 blur-3xl" />
      <div className="container-x section-y relative">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">{t.eyebrow}</p>
          <h2 id="technology-title" className="h-section mt-6">{t.title}</h2>
        </Reveal>

        <Reveal delay={0.1} className="mt-14 lg:mt-20">
          <ParallaxImage src={eyeMacro} alt={t.macroAlt} sizes="(min-width: 1320px) 1240px, 100vw" className="aspect-[4/3] rounded-[1.75rem] sm:aspect-[16/9] lg:aspect-[21/9]" imageClassName="object-[55%_45%]" strength={5} />
        </Reveal>

        <div className="mt-16 grid gap-12 lg:mt-24 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Reveal className="lg:sticky lg:top-28">
              <ParallaxImage src={slitLamp} alt={t.imageAlt} sizes="(min-width: 1024px) 40vw, 100vw" className="aspect-[4/5] rounded-[1.75rem] sm:aspect-[4/3] lg:aspect-[4/5]" imageClassName="object-[45%_40%]" />
            </Reveal>
          </div>
          <ol className="lg:col-span-7">
            {t.items.map((item, i) => (
              <Reveal as="li" key={item.title} delay={0.05 * i}>
                <div className="group grid grid-cols-[3.25rem_1fr] gap-4 border-t border-white/10 py-8 transition-colors duration-500 hover:border-ice-300/40 sm:grid-cols-[4.5rem_1fr] sm:py-10">
                  <span className="pt-1 text-[0.8rem] font-semibold tracking-[0.14em] text-ice-300/70 tabular-nums transition-colors duration-500 group-hover:text-ice-200">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-[1.45rem] font-light tracking-[-0.02em] transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:translate-x-1 sm:text-[1.7rem]">{item.title}</h3>
                    <p className="mt-3 max-w-lg leading-relaxed text-cold-300">{item.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
