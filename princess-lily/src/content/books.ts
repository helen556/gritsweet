/**
 * Затверджені назви, alt-тексти й описи книжок серії — одне джерело для seed (нова база) і
 * data-міграцій (наявна база). Назви — точно як на обкладинках. Українською песик — Бублик, англійською — Spotty.
 *
 * Англійська назва книжки про горщик лишається «How I Learned to Sit on the Potty» — так написано на англійській
 * обкладинці; нова (від 27.10.2026) українська назва «Як Лілі навчилася сідати на горщик» їй дослівно не відповідає.
 */
export type BookCopy = { title: string; alt: string; description: string };
export type BookContent = { id: string; uk: BookCopy; en: BookCopy };

export const POTTY_SLUG = "yak-lili-navchylasia-sidaty-na-horshchyk";
/** Попередні адреси сторінки книжки про горщик (постійна переадресація 301 у next.config.ts). */
export const POTTY_OLD_SLUGS = ["yak-ya-navchylasya-sydity-na-horshchyk", "lili-yak-ya-navchylasya-sydity-na-horshchyk"];

export const BOOK_TITLES = {
  doctor: { uk: "Лілі йде до лікаря", en: "Princess Lily Goes to the Doctor" },
  potty: { uk: "Як Лілі навчилася сідати на горщик", en: "How I Learned to Sit on the Potty" },
  bublik: { uk: "Як Лілі вчила Бублика стригти кігтики", en: "How Lily Helped Spotty Get His Nails Trimmed" },
  friend: { uk: "Лілі вчиться дружити", en: "Lily Learns to Be a Friend" },
  sleep: { uk: "Лілі та казка про сон", en: "Lily and the Bedtime Story" },
} as const;

const T = BOOK_TITLES;
const setList = (l: "uk" | "en") => [T.doctor, T.potty, T.bublik, T.friend, T.sleep].map((b) => `• ${b[l]}`).join("\n\n");

export const BOOK_CONTENT: BookContent[] = [
  {
    id: "prd_doctor",
    uk: {
      title: T.doctor.uk,
      alt: "Обкладинка книжки «Лілі йде до лікаря» із серії «Історії принцеси Лілі»: мама, Лілі із зайчиком і лікар",
      description: "Похід до лікаря може викликати багато запитань і трішки страху. Разом із Лілі маленькі читачі можуть заздалегідь познайомитися з цією ситуацією та знайти слова для своїх почуттів. Історія допомагає дорослим розпочати спокійну розмову про турботу, довіру та підтримку.",
    },
    en: {
      title: T.doctor.en,
      alt: "Cover of “Princess Lily Goes to the Doctor”: Mom, Lily with her bunny and the doctor",
      description: "A visit to the doctor can bring many questions and a little worry. Lily’s story helps young readers get to know the experience through a familiar character and gives families a gentle way to talk about feelings, care and reassurance.",
    },
  },
  {
    id: "prd_potty",
    uk: {
      title: T.potty.uk,
      alt: "Обкладинка книжки «Як Лілі навчилася сідати на горщик» із серії «Історії принцеси Лілі»: Лілі з песиком біля рожевого горщика",
      description: "Якщо ваш малюк какає стоячки й поки не хоче сідати на горщик, ця історія для вас. Разом із Лілі дитина знайомиться з горщиком із цікавістю, без сорому й поспіху. Читайте разом і говоріть про нові звички, самостійність і право вчитися у власному темпі.",
    },
    en: {
      title: T.potty.en,
      alt: "Cover of “How I Learned to Sit on the Potty” from the Princess Lily Stories series: Lily and her puppy next to a pink potty",
      description: "If your little one poops standing up and isn’t ready to sit on the potty yet, this story is for you. With Lily, children get to know the potty with curiosity, without shame or pressure. Read together and talk about new habits, independence and learning at your own pace.",
    },
  },
  {
    id: "prd_bublik",
    uk: {
      title: T.bublik.uk,
      alt: "Обкладинка книжки «Як Лілі вчила Бублика стригти кігтики» із серії «Історії принцеси Лілі»: Лілі, мама, тато й песик Бублик на ґанку",
      description: "Бублик має підстригти кігтики, але навіть звична турбота про улюбленця може стати новою пригодою. Разом із Лілі дитина познайомиться з незвичною процедурою спокійно, з увагою до почуттів і підтримкою близьких. Історія дає нагоду поговорити про дбайливе ставлення до тварин і про маленькі кроки, які допомагають упоратися з хвилюванням.",
    },
    en: {
      title: T.bublik.en,
      alt: "Cover of “How Lily Helped Spotty Get His Nails Trimmed” from the Princess Lily Stories series: Lily, Mom, Dad and Spotty the puppy on the porch",
      description: "A small moment of caring for a beloved dog becomes a gentle story about trying something unfamiliar. With Lily and Spotty, young readers can talk about kindness to animals, the feelings that come with new experiences and how reassuring it is to have someone by your side.",
    },
  },
  {
    id: "prd_friend",
    uk: {
      title: T.friend.uk,
      alt: "Обкладинка книжки «Лілі вчиться дружити» із серії «Історії принцеси Лілі»: Лілі із зайчиком грається з друзями на дитячому майданчику",
      description: "Знайомитися, ділитися іграшками й гратися разом — не завжди просто. Разом із Лілі малюки дізнаються, як знаходити друзів, домовлятися та підтримувати одне одного. Історія допомагає дорослим м’яко поговорити з дитиною про дружбу, доброту й почуття інших.",
    },
    en: {
      title: T.friend.en,
      alt: "Cover of “Lily Learns to Be a Friend” from the Princess Lily Stories series: Lily with her bunny playing with friends at the playground",
      description: "Making friends, sharing toys and playing together isn’t always easy. With Lily, little readers discover how to meet new friends, take turns and look out for one another. The story gives families a gentle way to talk about friendship, kindness and other people’s feelings.",
    },
  },
  {
    id: "prd_sleep",
    uk: {
      title: T.sleep.uk,
      alt: "Обкладинка книжки «Лілі та казка про сон» із серії «Історії принцеси Лілі»: мама читає Лілі казку перед сном",
      description: "Якщо ваш малюк щоразу протестує, коли час спати, ця історія для вас. Разом із Лілі діти дізнаються, що вечір може бути затишним, а сон — початком чарівних снів, а не кінцем веселощів. Тепла казка, яка допомагає перетворити вкладання на спокійний сімейний ритуал.",
    },
    en: {
      title: T.sleep.en,
      alt: "Cover of “Lily and the Bedtime Story” from the Princess Lily Stories series: Mom reads Lily a bedtime story",
      description: "If your little one resists bedtime, this story is for you. With Lily, children discover that evenings can be cozy and sleep can be the start of magical dreams rather than the end of the fun. A warm tale that helps turn bedtime into a calm family ritual.",
    },
  },
  {
    id: "prd_set5",
    uk: {
      title: "Комплект із 5 книжок «Історії принцеси Лілі»",
      alt: "Комплект із п’яти книжок «Історії принцеси Лілі»: обкладинки всіх книжок серії",
      description: `Усі п’ять книжок серії в одному комплекті:\n\n${setList("uk")}`,
    },
    en: {
      title: "Princess Lily Stories: 5-Book Set",
      alt: "Princess Lily Stories 5-book set: covers of all five books in the series",
      description: `All five books of the series in one set:\n\n${setList("en")}`,
    },
  },
];

/**
 * Попередні описи (з бази станом на 27.10.2026 і зі старого seed). Міграція замінює опис лише тоді,
 * коли він досі збігається з одним із цих текстів або порожній — відредаговане в адмінці не чіпаємо.
 */
export const OLD_DESCRIPTIONS: Record<string, Partial<Record<"uk" | "en", string[]>>> = {
  prd_doctor: { en: ["A visit to the doctor can bring many questions and a little worry. Lily's story helps young readers get to know the experience through a familiar character and gives families a gentle way to talk about feelings, care, and reassurance."] },
  prd_potty: {
    uk: ["Знайомство з горщиком — великий крок для маленької дитини. Історія Лілі допомагає підійти до нього з цікавістю, без сорому та поспіху. Читайте разом і говоріть про нові звички, самостійність та право вчитися у власному темпі."],
    en: ["Learning to use the potty can feel like a big step. Lily's story invites children to explore it with curiosity, without shame or pressure. It opens a warm conversation about new habits, independence, and learning at your own pace."],
  },
  prd_bublik: {
    uk: ["Бублик має підстригти кігтики, але навіть звична турбота про улюбленця може стати новою пригодою. Разом із Лілі дитина познайомиться з незвичною процедурою спокійно, з увагою до почуттів і підтримкою близьких. Історія дає нагоду поговорити про дбайливе ставлення до тварин та про маленькі кроки, які допомагають впоратися з хвилюванням."],
    en: ["A small moment of caring for a beloved dog becomes a gentle story about trying something unfamiliar. With Lily and Spotty, young readers can talk about kindness to animals, the feelings that come with new experiences, and how reassuring it is to have someone by your side."],
  },
  prd_friend: { en: ["Making friends, sharing toys and playing together isn’t always easy. With Lily, little readers discover how to meet new friends, take turns and look out for one another. The story gives families a gentle way to talk about friendship, kindness, and other people’s feelings.", "Making friends, sharing toys and playing together isn't always easy. With Lily, little readers discover how to meet new friends, take turns and look out for one another. The story gives families a gentle way to talk about friendship, kindness, and other people's feelings."] },
  prd_sleep: { en: ["If your little one resists bedtime, this story is for you. With Lily, children discover that evenings can be cosy and sleep can be the start of magical dreams rather than the end of the fun. A warm tale that helps turn bedtime into a calm family ritual."] },
  prd_set5: {
    uk: ["Усі п’ять книжок серії в одному комплекті:\n\n• Лілі йде до лікаря\n\n• Лілі: як я навчилася сидіти на горщик\n\n• Як Лілі вчила Бублика стригти кігтики\n\n• Лілі вчиться дружити\n\n• Лілі та казка про сон"],
  },
};
