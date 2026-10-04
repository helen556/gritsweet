import type { Dictionary } from "@/content/dictionaries";
import { Reveal } from "@/components/motion";

export function Reviews({ t }: { t: Dictionary["reviews"] }) {
  return (
    <section id="reviews" aria-labelledby="reviews-title" className="relative overflow-hidden bg-cold-50">
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 left-[-10%] size-[40rem] rounded-full bg-ice-100 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute top-0 right-[5%] size-[22rem] rounded-full bg-leaf-100/70 blur-3xl" />
      <div className="container-x section-y relative">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">{t.eyebrow}</p>
          <h2 id="reviews-title" className="h-section mt-6">{t.title}</h2>
        </Reveal>
        <ul className="mt-14 grid gap-5 md:grid-cols-3 lg:mt-20">
          {t.items.map((r, i) => (
            <Reveal as="li" key={r.name} delay={i * 0.08}>
              <figure className="glass flex h-full flex-col rounded-[1.75rem] p-8 shadow-[var(--shadow-soft)] transition-[transform,box-shadow] duration-700 ease-[var(--ease-out-expo)] hover:-translate-y-1.5 hover:shadow-[var(--shadow-lift)] sm:p-9">
                <svg viewBox="0 0 32 24" className="w-8 text-ice-300" fill="currentColor" aria-hidden="true">
                  <path d="M0 24V14C0 6 4.5 1.3 12 0l1.3 3.4C8.6 4.8 6.4 7.6 6.2 12H12v12H0Zm19 0V14c0-8 4.5-12.7 12-14l1 3.4c-4.7 1.4-6.9 4.2-7.1 8.6H31v12H19Z" />
                </svg>
                <blockquote className="mt-6 flex-1 text-[1.08rem] leading-relaxed text-graphite-700">{r.text}</blockquote>
                <figcaption className="mt-8 flex items-center gap-3 border-t border-graphite-800/8 pt-6">
                  <span className="grid size-10 place-items-center rounded-full bg-graphite-800 text-[0.9rem] font-medium text-white">{r.name[0]}</span>
                  <span className="font-medium">{r.name}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
