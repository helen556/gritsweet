import clinic from "@/assets/04_clear_clinic.png";
import type { Dictionary } from "@/content/dictionaries";
import { ParallaxImage } from "@/components/ParallaxImage";
import { Reveal } from "@/components/motion";
import { ArrowIcon } from "@/components/Icon";

export function Contacts({ t }: { t: Dictionary["contacts"] }) {
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Clario Vision Clinic, Київ, вул. Антоновича, 24")}`;
  const rows = [
    { label: t.labels.address, value: t.address },
    { label: t.labels.phone, value: t.phone, href: t.phoneHref },
    { label: t.labels.email, value: t.email, href: `mailto:${t.email}` },
    { label: t.labels.hours, value: t.hours },
  ];
  return (
    <section id="contacts" aria-labelledby="contacts-title" className="bg-white">
      <div className="container-x section-y">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">{t.eyebrow}</p>
          <h2 id="contacts-title" className="h-section mt-6">{t.title}</h2>
        </Reveal>
        <div className="relative mt-14 lg:mt-20">
          <Reveal>
            <ParallaxImage src={clinic} alt={t.imageAlt} sizes="(min-width: 1320px) 1240px, 100vw" className="aspect-[4/3] rounded-[2rem] sm:aspect-[16/9] lg:aspect-[21/10]" imageClassName="object-[60%_50%]" />
          </Reveal>
          <Reveal delay={0.15} className="relative -mt-24 px-3 sm:-mt-32 sm:px-6 lg:absolute lg:top-1/2 lg:left-10 lg:mt-0 lg:w-[27rem] lg:-translate-y-1/2 lg:px-0">
            <address className="rounded-[1.75rem] border border-white/80 bg-white/90 p-7 backdrop-blur-2xl not-italic shadow-[var(--shadow-lift)] sm:p-9">
              <p className="text-[1.35rem] font-medium tracking-[-0.015em]">{t.name}</p>
              <dl className="mt-6 grid gap-5">
                {rows.map((r) => (
                  <div key={r.label}>
                    <dt className="text-[0.7rem] font-semibold tracking-[0.2em] text-ice-700 uppercase">{r.label}</dt>
                    <dd className="mt-1.5 text-[1.02rem] text-graphite-800">
                      {r.href ? (
                        <a href={r.href} className="transition-colors duration-300 hover:text-ice-700">{r.value}</a>
                      ) : (
                        r.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="group mt-8 inline-flex items-center gap-2 text-[0.9rem] font-semibold text-graphite-800 transition-colors hover:text-ice-700">
                {t.map}
                <ArrowIcon className="size-4 -rotate-45 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            </address>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
