import Image from "next/image";
import type { Dictionary } from "@/content/dictionaries";
import { doctorPhotos } from "@/content/doctor-photos";
import { EyeMark } from "@/components/Icon";
import { Reveal } from "@/components/motion";

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("");

/** Placeholder portrait in the clinic palette, used until real photos are provided. */
function Monogram({ name, index }: { name: string; index: number }) {
  const tints = [
    "from-graphite-700 via-graphite-800 to-graphite-950",
    "from-[#3a4148] via-graphite-800 to-graphite-950",
    "from-graphite-600 via-graphite-700 to-graphite-900",
    "from-[#34404a] via-graphite-800 to-graphite-950",
  ];
  return (
    <div className={`absolute inset-0 bg-gradient-to-b ${tints[index % tints.length]}`}>
      <div className="absolute -top-16 -right-10 size-64 rounded-full bg-ice-300/25 blur-3xl" />
      <div className="absolute -bottom-20 -left-10 size-56 rounded-full bg-leaf-500/15 blur-3xl" />
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-[5.5rem] font-extralight tracking-[-0.04em] text-white/85">{initials(name)}</span>
      </div>
      <EyeMark className="absolute top-6 left-6 w-9 text-white/35" />
    </div>
  );
}

export function Doctors({ t }: { t: Dictionary["doctors"] }) {
  return (
    <section id="doctors" aria-labelledby="doctors-title" className="bg-white">
      <div className="container-x section-y">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">{t.eyebrow}</p>
          <h2 id="doctors-title" className="h-section mt-6">{t.title}</h2>
        </Reveal>

        <ul className="mt-14 grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
          {t.items.map((d, i) => {
            const photo = doctorPhotos[i];
            return (
              <Reveal as="li" key={d.name} delay={i * 0.08}>
                <article className="group">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-graphite-800 shadow-[var(--shadow-soft)] transition-shadow duration-700 group-hover:shadow-[var(--shadow-lift)]" data-cursor="media">
                    <div className="absolute inset-0 transition-transform duration-[1400ms] ease-[var(--ease-out-expo)] group-hover:scale-[1.035]">
                      {photo ? (
                        <Image src={photo} alt={`${d.name} — ${d.role}`} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" placeholder="blur" quality={92} className="object-cover" />
                      ) : (
                        <Monogram name={d.name} index={i} />
                      )}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-graphite-950/45 to-transparent" aria-hidden="true" />
                  </div>
                  <h3 className="mt-6 text-[1.25rem] font-medium tracking-[-0.015em]">{d.name}</h3>
                  <p className="mt-1 text-[0.82rem] font-semibold tracking-[0.12em] text-ice-700 uppercase">{d.role}</p>
                  <p className="mt-3 text-[0.96rem] leading-relaxed text-graphite-600">{d.focus}</p>
                </article>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
