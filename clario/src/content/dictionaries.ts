// Site copy. Ukrainian texts are the client's final wording — keep them verbatim.
// English is a direct translation of the Ukrainian.

export const locales = ["uk", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "uk";

export const isLocale = (value: string): value is Locale => (locales as readonly string[]).includes(value);

/** Public path for a locale: Ukrainian lives at the root, English under /en. */
export const localePath = (lang: Locale) => (lang === "uk" ? "/" : "/en");

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://clariovision.com").replace(/\/$/, "");

export type ServiceId = "consultation" | "diagnostics" | "pediatric" | "laser" | "cataract" | "optics";

const uk = {
  meta: {
    title: "Clario Vision Clinic — офтальмологічна клініка у Києві",
    description:
      "Сучасна діагностика, уважні лікарі та комфортна клініка для всієї родини. Консультація офтальмолога, комплексна діагностика зору, дитяча офтальмологія, лазерна корекція зору.",
    ogLocale: "uk_UA",
  },
  ui: {
    skip: "Перейти до змісту",
    menu: "Меню",
    close: "Закрити",
    home: "Clario Vision Clinic — на головну",
    primaryNav: "Основна навігація",
    language: "Мова",
    scroll: "Гортати далі",
  },
  nav: [
    { href: "#about", label: "Про клініку" },
    { href: "#services", label: "Послуги" },
    { href: "#doctors", label: "Лікарі" },
    { href: "#technology", label: "Технології" },
    { href: "#prices", label: "Ціни" },
    { href: "#contacts", label: "Контакти" },
  ],
  cta: { primary: "Записатися", secondary: "Детальніше" },
  hero: {
    title: "Почни дивитися на світ чітко",
    text: "Сучасна діагностика, уважні лікарі та комфортна клініка для всієї родини.",
  },
  about: {
    eyebrow: "Про клініку",
    title: "Комплексна турбота про зір — в одному місці",
    text: "Clario Vision Clinic — сучасна офтальмологічна клініка, де точна діагностика, сучасні технології та уважний підхід до пацієнта працюють разом. Тут можна пройти консультацію, обстеження, підібрати корекцію зору та отримати рекомендації для дітей і дорослих.",
    points: ["Сучасне обладнання", "Досвідчені лікарі", "Для дітей і дорослих", "Комфортний сервіс"],
    imageAlt: "Світлий кабінет Clario Vision Clinic з офтальмологічним кріслом, щілинною лампою та панорамними вікнами.",
  },
  services: {
    eyebrow: "Послуги",
    title: "Послуги",
    book: "Записатися",
    items: [
      { id: "consultation", title: "Первинна консультація офтальмолога" },
      { id: "diagnostics", title: "Комплексна діагностика зору" },
      { id: "pediatric", title: "Дитяча офтальмологія" },
      { id: "laser", title: "Лазерна корекція зору" },
      { id: "cataract", title: "Діагностика катаракти" },
      { id: "optics", title: "Підбір окулярів і контактних лінз" },
    ] satisfies { id: ServiceId; title: string }[],
  },
  doctors: {
    eyebrow: "Лікарі",
    title: "Лікарі",
    items: [
      { name: "Олена Кравченко", role: "Лікар-офтальмолог", focus: "Дитяча та доросла діагностика" },
      { name: "Андрій Мельник", role: "Офтальмохірург", focus: "Лазерна корекція зору" },
      { name: "Ірина Соколова", role: "Лікар-офтальмолог", focus: "Лікування сухого ока та захворювань сітківки" },
      { name: "Максим Гнатюк", role: "Оптометрист", focus: "Підбір окулярів і контактних лінз" },
    ],
  },
  technology: {
    eyebrow: "Технології",
    title: "Технології",
    imageAlt: "Щілинна лампа в оглядовому кабінеті Clario Vision Clinic.",
    macroAlt: "Огляд ока пацієнта крупним планом.",
    items: [
      { title: "ОКТ-діагностика", text: "Пошарове зображення сітківки та зорового нерва — без контакту з оком, за кілька хвилин." },
      { title: "Цифрова діагностика сітківки", text: "Знімки очного дна у високій якості, щоб помітити зміни на ранній стадії та порівнювати їх із часом." },
      { title: "Безконтактна тонометрія", text: "Вимірювання очного тиску легким потоком повітря — швидко й без дотику до ока." },
      { title: "Кератотопографія", text: "Детальна карта поверхні рогівки — основа для підбору лінз і планування лазерної корекції." },
      { title: "Щілинна лампа", text: "Мікроскоп для огляду структур ока при великому збільшенні." },
      { title: "Лазерна корекція зору", text: "Процедура, яка допомагає зменшити залежність від окулярів і контактних лінз." },
    ],
  },
  prices: {
    eyebrow: "Ціни",
    title: "Ціни",
    items: [
      { title: "Первинна консультація", price: "800 грн" },
      { title: "Комплексна діагностика зору", price: "1400 грн" },
      { title: "Дитяча консультація", price: "900 грн" },
      { title: "ОКТ-діагностика", price: "1200 грн" },
      { title: "Підбір окулярів / лінз", price: "700 грн" },
      { title: "Лазерна корекція зору", price: "від 18 500 грн" },
    ],
  },
  // DEMO reviews — replace with real patient reviews (with consent) before launch.
  reviews: {
    eyebrow: "Відгуки",
    title: "Відгуки",
    items: [
      { name: "Наталія", text: "Дуже уважний огляд: лікарка все пояснила й показала знімки на екрані. Жодного поспіху." },
      { name: "Олександр", text: "Робив лазерну корекцію. Від консультації до контрольного огляду все було чітко й спокійно." },
      { name: "Марина", text: "Приходили з сином на дитячу консультацію. Йому було комфортно, а мені — зрозуміло." },
    ],
  },
  faq: {
    eyebrow: "FAQ",
    title: "Часті запитання",
    items: [
      { q: "Скільки триває комплексний огляд?", a: "Розраховуйте на 60–90 хвилин. Сюди входять вимірювання, обстеження та час з офтальмологом, щоб обговорити результати." },
      { q: "Чи будуть розширювати зіниці?", a: "Більшість комплексних оглядів передбачає розширення зіниць, щоб чітко побачити сітківку. Кілька годин зір може бути нечітким і чутливим до світла, тож після візиту краще не сідати за кермо." },
      { q: "Що взяти з собою?", a: "Ваші окуляри та контактні лінзи, список ліків, попередні офтальмологічні висновки й сонцезахисні окуляри на час після розширення зіниць." },
      { q: "Чи потрібне направлення?", a: "Для огляду направлення не потрібне. Якщо воно у вас є від лікаря чи оптометриста — візьміть його з собою." },
      { q: "Чи можна прийти в контактних лінзах?", a: "На звичайний огляд — так. Перед обстеженням для корекції зору чи хірургії катаракти ми можемо попросити не носити лінзи певний час — уточнимо це під час запису." },
    ],
  },
  booking: {
    eyebrow: "Запис",
    title: "Запис на прийом",
    panelTitle: "Запис на прийом",
    fields: {
      name: "Ім’я",
      phone: "Телефон",
      email: "Email",
      service: "Послуга",
      servicePlaceholder: "Оберіть послугу",
      date: "Бажана дата",
      comment: "Коментар",
    },
    submit: "Записатися",
    sending: "Надсилаємо…",
    errors: {
      name: "Вкажіть ім’я",
      phone: "Вкажіть коректний номер телефону",
      email: "Перевірте email",
      service: "Оберіть послугу",
      date: "Оберіть дату не раніше сьогоднішньої",
      summary: "Будь ласка, виправте позначені поля.",
      server: "Не вдалося надіслати заявку. Спробуйте ще раз або зателефонуйте нам.",
    },
    success: {
      title: "Дякуємо!",
      text: "Заявку отримано. Ми зв’яжемося з вами, щоб підтвердити запис.",
      again: "Нова заявка",
    },
  },
  contacts: {
    eyebrow: "Контакти",
    title: "Контакти",
    name: "Clario Vision Clinic",
    address: "м. Київ, вул. Антоновича, 24",
    phone: "+38 (044) 123 45 67",
    phoneHref: "tel:+380441234567",
    email: "hello@clariovision.com",
    hours: "Пн–Сб: 09:00–19:00",
    labels: { address: "Адреса", phone: "Телефон", email: "Email", hours: "Графік" },
    map: "Відкрити на мапі",
    imageAlt: "Інтер’єр Clario Vision Clinic.",
  },
  footer: { rights: "Усі права захищено." },
  notFound: {
    code: "404",
    title: "Сторінку не знайдено",
    text: "Можливо, посилання застаріло або сторінку було переміщено.",
    back: "На головну",
  },
};

export type Dictionary = typeof uk;

const en: Dictionary = {
  meta: {
    title: "Clario Vision Clinic — Ophthalmology Clinic in Kyiv",
    description:
      "Modern diagnostics, attentive doctors and a comfortable clinic for the whole family. Ophthalmologist consultations, comprehensive eye examinations, paediatric ophthalmology and laser vision correction.",
    ogLocale: "en_US",
  },
  ui: {
    skip: "Skip to content",
    menu: "Menu",
    close: "Close",
    home: "Clario Vision Clinic — home",
    primaryNav: "Main navigation",
    language: "Language",
    scroll: "Scroll down",
  },
  nav: [
    { href: "#about", label: "About" },
    { href: "#services", label: "Services" },
    { href: "#doctors", label: "Doctors" },
    { href: "#technology", label: "Technology" },
    { href: "#prices", label: "Prices" },
    { href: "#contacts", label: "Contacts" },
  ],
  cta: { primary: "Book now", secondary: "Learn more" },
  hero: {
    title: "Start seeing the world clearly",
    text: "Modern diagnostics, attentive doctors and a comfortable clinic for the whole family.",
  },
  about: {
    eyebrow: "About the clinic",
    title: "Comprehensive eye care — all in one place",
    text: "Clario Vision Clinic is a modern ophthalmology clinic where precise diagnostics, modern technology and an attentive approach to each patient work together. Here you can have a consultation and an examination, choose vision correction and get recommendations for children and adults.",
    points: ["Modern equipment", "Experienced doctors", "For children and adults", "Comfortable service"],
    imageAlt: "A bright Clario Vision Clinic examination room with an ophthalmic chair, slit lamp and panoramic windows.",
  },
  services: {
    eyebrow: "Services",
    title: "Services",
    book: "Book",
    items: [
      { id: "consultation", title: "Initial ophthalmologist consultation" },
      { id: "diagnostics", title: "Comprehensive eye examination" },
      { id: "pediatric", title: "Paediatric ophthalmology" },
      { id: "laser", title: "Laser vision correction" },
      { id: "cataract", title: "Cataract diagnostics" },
      { id: "optics", title: "Glasses and contact lens fitting" },
    ],
  },
  doctors: {
    eyebrow: "Doctors",
    title: "Doctors",
    items: [
      { name: "Olena Kravchenko", role: "Ophthalmologist", focus: "Paediatric and adult diagnostics" },
      { name: "Andrii Melnyk", role: "Ophthalmic surgeon", focus: "Laser vision correction" },
      { name: "Iryna Sokolova", role: "Ophthalmologist", focus: "Dry eye and retinal disease treatment" },
      { name: "Maksym Hnatiuk", role: "Optometrist", focus: "Glasses and contact lens fitting" },
    ],
  },
  technology: {
    eyebrow: "Technology",
    title: "Technology",
    imageAlt: "A slit lamp in a Clario Vision Clinic examination room.",
    macroAlt: "Close-up of a patient's eye during an examination.",
    items: [
      { title: "OCT diagnostics", text: "Layer-by-layer images of the retina and optic nerve — no contact with the eye, in just a few minutes." },
      { title: "Digital retinal imaging", text: "High-quality images of the back of the eye to spot changes early and compare them over time." },
      { title: "Non-contact tonometry", text: "Eye pressure measured with a gentle puff of air — quick and without touching the eye." },
      { title: "Corneal topography", text: "A detailed map of the corneal surface — the basis for lens fitting and laser correction planning." },
      { title: "Slit lamp", text: "A microscope for examining the structures of the eye at high magnification." },
      { title: "Laser vision correction", text: "A procedure that helps reduce dependence on glasses and contact lenses." },
    ],
  },
  prices: {
    eyebrow: "Prices",
    title: "Prices",
    items: [
      { title: "Initial consultation", price: "800 UAH" },
      { title: "Comprehensive eye examination", price: "1,400 UAH" },
      { title: "Paediatric consultation", price: "900 UAH" },
      { title: "OCT diagnostics", price: "1,200 UAH" },
      { title: "Glasses / lens fitting", price: "700 UAH" },
      { title: "Laser vision correction", price: "from 18,500 UAH" },
    ],
  },
  reviews: {
    eyebrow: "Reviews",
    title: "Reviews",
    items: [
      { name: "Nataliia", text: "A very thorough exam: the doctor explained everything and showed me the scans on screen. No rush at all." },
      { name: "Oleksandr", text: "I had laser correction. From the consultation to the follow-up, everything was clear and calm." },
      { name: "Maryna", text: "We came with my son for a paediatric consultation. He felt comfortable, and I understood everything." },
    ],
  },
  faq: {
    eyebrow: "FAQ",
    title: "Frequently asked questions",
    items: [
      { q: "How long does a comprehensive exam take?", a: "Allow 60–90 minutes. This includes measurements, imaging and time with your ophthalmologist to discuss the results." },
      { q: "Will my pupils be dilated?", a: "Most comprehensive exams include pupil dilation so the retina can be seen clearly. Your vision may be blurred and light-sensitive for a few hours, so it is best not to drive after the visit." },
      { q: "What should I bring?", a: "Your glasses and contact lenses, a list of medications, previous eye reports and sunglasses for after dilation." },
      { q: "Do I need a referral?", a: "No referral is needed for an exam. If you have one from a doctor or optometrist, please bring it along." },
      { q: "Can I come wearing contact lenses?", a: "For a routine exam, yes. Before a vision correction or cataract assessment we may ask you to stop wearing lenses for a while — we will confirm this when you book." },
    ],
  },
  booking: {
    eyebrow: "Booking",
    title: "Book an appointment",
    panelTitle: "Book an appointment",
    fields: {
      name: "Name",
      phone: "Phone",
      email: "Email",
      service: "Service",
      servicePlaceholder: "Choose a service",
      date: "Preferred date",
      comment: "Comment",
    },
    submit: "Book now",
    sending: "Sending…",
    errors: {
      name: "Please enter your name",
      phone: "Please enter a valid phone number",
      email: "Please check your email",
      service: "Please choose a service",
      date: "Please choose today or a later date",
      summary: "Please correct the highlighted fields.",
      server: "We couldn't send your request. Please try again or call us.",
    },
    success: {
      title: "Thank you!",
      text: "Your request has been received. We will contact you to confirm your appointment.",
      again: "New request",
    },
  },
  contacts: {
    eyebrow: "Contacts",
    title: "Contacts",
    name: "Clario Vision Clinic",
    address: "24 Antonovycha St, Kyiv",
    phone: "+38 (044) 123 45 67",
    phoneHref: "tel:+380441234567",
    email: "hello@clariovision.com",
    hours: "Mon–Sat: 09:00–19:00",
    labels: { address: "Address", phone: "Phone", email: "Email", hours: "Hours" },
    map: "Open in maps",
    imageAlt: "Clario Vision Clinic interior.",
  },
  footer: { rights: "All rights reserved." },
  notFound: {
    code: "404",
    title: "Page not found",
    text: "The link may be out of date, or the page may have moved.",
    back: "Back to home",
  },
};

const dictionaries: Record<Locale, Dictionary> = { uk, en };
export const getDictionary = (lang: Locale) => dictionaries[lang];
