import consultation from "@/assets/consultation.png";
import type { Dictionary } from "@/content/dictionaries";
import { ParallaxImage } from "@/components/ParallaxImage";
import { Reveal } from "@/components/motion";

const pointIcons = [
  "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  "M12 4l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 9.3l5-.7L12 4Z",
  "M8 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm8 3a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3.5 20c0-4 2-6.5 4.5-6.5s4.5 2.5 4.5 6.5M13 20c0-3 1.3-5 3-5s3 2 3 5",
  "M4 14c3 0 5-2 8-2s5 2 8 2M6 10c2.5 0 3.5-2 6-2s3.5 2 6 2M12 4v4",
];

export function About({ t }: { t: Dictionary["about"] }) {
  return (
    <section id="about" aria-labelledby="about-title" className="relative z-10 -mt-8 rounded-t-[2rem] bg-white sm:-mt-10 sm:rounded-t-[2.5rem]">
      <div className="container-x section-y grid items-center gap-14 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-6">
          <Reveal>
            <p className="eyebrow">{t.eyebrow}</p>
            <h2 id="about-title" className="h-section mt-6">{t.title}</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-8 max-w-xl text-[1.06rem] leading-relaxed text-graphite-600">{t.text}</p>
          </Reveal>
          <ul className="mt-12 grid gap-3 sm:grid-cols-2">
            {t.points.map((p, i) => (
              <Reveal as="li" key={p} delay={0.15 + i * 0.08}>
                <div className="group flex h-full items-center gap-4 rounded-2xl border border-graphite-800/8 bg-cold-50/70 px-5 py-4 transition-[transform,box-shadow,background-color,border-color] duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:border-ice-200 hover:bg-white hover:shadow-[var(--shadow-soft)]">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-ice-700 shadow-[0_0_0_1px_rgb(208_221_231/0.8)] transition-transform duration-500 group-hover:scale-110">
                    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d={pointIcons[i % pointIcons.length]} />
                    </svg>
                  </span>
                  <span className="font-medium text-graphite-800">{p}</span>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>

        <Reveal delay={0.1} className="lg:col-span-6">
          <div className="relative">
            <ParallaxImage src={consultation} alt={t.imageAlt} sizes="(min-width: 1024px) 50vw, 100vw" className="aspect-[4/5] rounded-[2rem] shadow-[var(--shadow-lift)] sm:aspect-[4/3] lg:aspect-[4/5]" imageClassName="object-[42%_50%]" />
            <div className="glass absolute bottom-5 left-5 flex items-center gap-3 rounded-full py-2.5 pr-5 pl-3 text-[0.82rem] font-medium shadow-[var(--shadow-soft)]" aria-hidden="true">
              <span className="relative grid size-6 place-items-center">
                <span className="absolute size-6 animate-ping rounded-full bg-leaf-500/25 [animation-duration:2.8s]" />
                <span className="size-2 rounded-full bg-leaf-500" />
              </span>
              Clario Vision Clinic
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
