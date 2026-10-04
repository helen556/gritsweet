import blurred from "@/assets/01_blurred_clinic.png";
import type { Dictionary, Locale } from "@/content/dictionaries";
import { BookingForm } from "@/components/booking/BookingForm";
import { ParallaxImage } from "@/components/ParallaxImage";
import { Reveal } from "@/components/motion";

type Props = { t: Dictionary["booking"]; services: Dictionary["services"]["items"]; contacts: Dictionary["contacts"]; lang: Locale };

export function BookingSection({ t, services, contacts, lang }: Props) {
  return (
    <section id="booking" aria-labelledby="booking-title" className="on-dark relative isolate overflow-hidden rounded-[2rem] bg-graphite-900 text-white sm:rounded-[2.5rem]">
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        <ParallaxImage src={blurred} alt="" sizes="100vw" className="size-full" strength={6} />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgb(21_24_26/0.86)_0%,rgb(21_24_26/0.6)_50%,rgb(21_24_26/0.35)_100%)]" />
      </div>
      <div className="container-x section-y grid items-center gap-14 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-5">
          <p className="eyebrow">{t.eyebrow}</p>
          <h2 id="booking-title" className="h-section mt-6">{t.title}</h2>
          <dl className="mt-12 grid gap-6 text-white/85">
            <div>
              <dt className="text-[0.72rem] font-semibold tracking-[0.2em] text-ice-200 uppercase">{contacts.labels.phone}</dt>
              <dd className="mt-2 text-[1.35rem] font-light">
                <a href={contacts.phoneHref} className="transition-colors hover:text-white">{contacts.phone}</a>
              </dd>
            </div>
            <div>
              <dt className="text-[0.72rem] font-semibold tracking-[0.2em] text-ice-200 uppercase">{contacts.labels.hours}</dt>
              <dd className="mt-2">{contacts.hours}</dd>
            </div>
          </dl>
        </Reveal>
        <Reveal delay={0.12} className="lg:col-span-7">
          <div className="rounded-[2rem] border border-white/60 bg-white/88 p-6 text-graphite-800 shadow-[0_40px_90px_-30px_rgb(0_0_0/0.6)] backdrop-blur-2xl sm:p-10">
            <BookingForm t={t} services={services} lang={lang} />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
