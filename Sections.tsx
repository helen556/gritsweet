import { Reveal } from "./Reveal";
import { Picture } from "./Picture";
import type { PublicCategory } from "@/lib/catalog";
import { formatUaPhone } from "@/lib/phone";
import { Reviews } from "./Reviews";
import { Works } from "./Works";

export function Categories({ categories }: { categories: PublicCategory[] }) {
  const main = ["torty", "bento", "kapkeiky", "zefir"];
  const list = main.map((s) => categories.find((c) => c.slug === s)).filter(Boolean) as PublicCategory[];
  return (
    <section className="section-light py-16 md:py-24" aria-labelledby="cat-h">
      <div className="wrap">
        <Reveal><h2 id="cat-h" className="text-4xl md:text-5xl">Що я готую</h2></Reveal>
        <ul className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          {list.map((c, i) => (
            <Reveal key={c.id} as="li" delay={i * 70}>
              <a href="#kataloh" className="group block overflow-hidden rounded-[1.25rem] bg-white shadow-[var(--shadow-cream)]">
                <Picture src={c.image_path} alt={c.name} className="aspect-square" imgClassName="transition-transform duration-500 group-hover:scale-[1.04]" />
                <div className="p-4">
                  <h3 className="text-2xl">{c.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{c.description}</p>
                </div>
              </a>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Flowers() {
  return (
    <section id="kvity" className="section-dark py-16 md:py-24" aria-labelledby="fl-h">
      <div className="wrap">
        <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
          <Reveal>
            <h2 id="fl-h" className="text-4xl md:text-5xl">Зефірні квіти та подарункові композиції</h2>
            <p className="mt-5 text-cream/80">Кожна пелюстка — із зефіру, сформована вручну. Коробочки трьох розмірів і маленькі букети — на подарунок або як прикраса до торта.</p>
            <a href="#zamovlennia" className="btn btn-cream mt-7">Замовити квіти</a>
          </Reveal>
          <div className="grid grid-cols-2 gap-3">
            <Reveal delay={80}><Picture src="/images/small-box.jpg" alt="Коробочка з ніжними зефірними квітами" className="aspect-[3/4] rounded-[1.25rem]" /></Reveal>
            <Reveal delay={160} className="mt-8"><Picture src="/images/autumn-bowl.jpg" alt="Осіння квіткова композиція у шоколадній чаші" className="aspect-[3/4] rounded-[1.25rem]" /></Reveal>
            <Reveal delay={240} className="col-span-2"><Picture src="/images/pink-box.jpg" alt="Великий рожевий квітковий бокс" className="aspect-[16/9] rounded-[1.25rem]" /></Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

export function WorksSection({ items, instagram }: { items: import("./Reviews").PublicReview[]; instagram: string }) {
  return (
    <section id="roboty" className="section-light py-16 md:py-24" aria-labelledby="wk-h">
      <div className="wrap">
        {items.length > 0 && <>
          <Reveal><h2 id="wk-h" className="text-4xl md:text-5xl">Мої роботи</h2>
            <p className="mt-3 max-w-prose text-muted">Торти, рулети, зефірні квіти та фігурки — натисніть, щоб роздивитися ближче.</p></Reveal>
          <div className="mt-8"><Works items={items} /></div>
        </>}
        <Reveal className="mt-14 rounded-[1.5rem] bg-choco p-6 text-center text-cream md:p-10">
          <p className="mx-auto max-w-2xl text-lg text-cream/90 md:text-xl">Тут — лише частинка моїх солодких робіт. Більше тортів, зефірних букетів та ідей для вашого свята — у моєму Instagram.</p>
          <a href={instagram} target="_blank" rel="noopener noreferrer" className="btn btn-cream mt-6">Більше фото робіт в Instagram</a>
        </Reveal>
      </div>
    </section>
  );
}

export function ReviewsSection({ items, instagram }: { items: import("./Reviews").PublicReview[]; instagram: string }) {
  if (items.length === 0) return null;
  return (
    <section id="vidhuky" className="section-dark py-16 md:py-24" aria-labelledby="rv-h">
      <div className="wrap">
        <Reveal><h2 id="rv-h" className="text-4xl md:text-5xl">Ваші відгуки — моя найбільша радість</h2>
          <p className="mt-3 max-w-prose text-cream/75">Скриншоти повідомлень від клієнтів. Гортайте або натисніть, щоб збільшити.</p></Reveal>
        <div className="mt-8"><Reviews items={items} /></div>
        <p className="mt-6 text-sm text-cream/75">Ще більше робіт і відгуків — <a href={instagram} target="_blank" rel="noopener noreferrer" className="font-semibold text-cream underline decoration-caramel underline-offset-4">@grid_sweet_life</a>.</p>
      </div>
    </section>
  );
}

export function About({ text, photo }: { text: string; photo: string }) {
  return (
    <section id="pro-mene" className="section-milk py-16 md:py-24" aria-labelledby="ab-h">
      <div className="wrap grid gap-10 md:grid-cols-[5fr_7fr] md:gap-16">
        <Reveal>
          {photo ? (
            <Picture src={photo} alt="Дар’я з букетом зефірних квітів" className="aspect-[4/5] rounded-[1.5rem] shadow-[var(--shadow-cream)]" imgClassName="object-top" />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center rounded-[1.5rem] bg-white/60 p-6 text-center text-sm text-muted" role="img" aria-label="Місце для фото Дар’ї">
              Фото Дар’ї додається в адмінці: Тексти та налаштування → Фото «Про мене»
            </div>
          )}
        </Reveal>
        <Reveal delay={100}>
          <h2 id="ab-h" className="text-4xl md:text-5xl">Про мене</h2>
          <div className="prose-about mt-6 max-w-prose text-[1.05rem] leading-relaxed">
            {text.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <p className="hand mt-4 text-4xl text-cherry">Ваша Дар’я</p>
        </Reveal>
      </div>
    </section>
  );
}

export function Terms({ terms, faq, leadDays }: { terms: string; faq: { q: string; a: string }[]; leadDays: string }) {
  return (
    <section id="umovy" className="section-light py-16 md:py-24" aria-labelledby="tm-h">
      <div className="wrap grid gap-10 md:grid-cols-2 md:gap-16">
        <Reveal>
          <h2 id="tm-h" className="text-4xl md:text-5xl">Умови замовлення</h2>
          <div className="prose-about mt-6 max-w-prose leading-relaxed">
            {terms.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
            <p className="text-sm text-muted">Рекомендований термін замовлення: {leadDays} днів.</p>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <h3 className="text-3xl">Часті запитання</h3>
          <div className="mt-4 divide-y divide-ink/10">
            {faq.map((f, i) => (
              <details key={i} className="group py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-2 text-lg font-medium">
                  {f.q}
                  <svg className="h-5 w-5 shrink-0 transition-transform group-open:rotate-45" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>
                </summary>
                <p className="pb-2 text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Contacts({ phone, instagram, city }: { phone: string; instagram: string; city: string }) {
  return (
    <footer id="kontakty" className="section-cocoa py-16 md:py-20">
      <div className="wrap">
        <Reveal>
          <h2 className="text-4xl md:text-5xl">Контакти</h2>
          <p className="mt-3 text-cream/75">{city}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={`tel:${phone}`} className="btn btn-cream">Зателефонувати {formatUaPhone(phone)}</a>
            <a href={instagram} target="_blank" rel="noopener noreferrer" className="btn btn-outline text-cream">Написати в Instagram</a>
          </div>
        </Reveal>
        <div className="mt-14 flex flex-col gap-3 border-t border-cream/10 pt-6 text-sm text-cream/60 sm:flex-row sm:items-center sm:justify-between">
          <span className="display text-xl text-cream/80">Grid Sweet Life</span>
          <a href="/pryvatnist" className="hover:text-cream">Обробка персональних даних</a>
        </div>
      </div>
    </footer>
  );
}

export function MobileCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 p-3 md:hidden" style={{ paddingBottom: "max(.75rem, env(safe-area-inset-bottom))" }} data-mobile-cta>
      <a href="#zamovlennia" className="btn btn-cherry w-full shadow-[var(--shadow-warm)]">Замовити</a>
    </div>
  );
}
