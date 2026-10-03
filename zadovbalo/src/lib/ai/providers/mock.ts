import type { CategoryId, Emotion, Tone } from "@/lib/topics/categories";
import { SCENARIOS } from "@/lib/scenarios/registry";
import { normalizeForMatching } from "@/lib/safety/normalize";
import type { RantClassifier } from "../types";

/**
 * Локальний класифікатор на ключових словах. Без мережі й без ключів.
 * Це заглушка для розробки й демо, а не імітація AI: точність обмежена списком основ нижче.
 */

// Основи слів (укр/рос/суржик). Збіг — за початком слова.
const KEYWORDS: Partial<Record<CategoryId, string[]>> = {
  war: ["війн", "войн", "росі", "русн", "рашист", "окупант", "орк", "фронт", "окупац", "путін", "путин"],
  air_raid: ["тривог", "сирен", "шахед", "обстріл", "обстрел", "ракет", "укриття", "бомбосхов"],
  bad_news: ["новин", "новост", "телеграм канал", "стрічк новин"],
  fear_for_family: ["за мам", "за тат", "за батьк", "за дітей", "за рідн", "за сім", "за родин"],
  uncertainty: ["невідом", "неизвестн", "невизначен", "не знаю що буде", "що далі", "що буде далі"],
  ex: ["колишн", "бувш", "бывш", "екс "],
  relationship_conflict: ["посварил", "поссорил", "сварк", "ссор", "скандал"],
  waiting_for_reply: ["не відповіда", "не отвеча", "ігнорит", "игнорит", "прочитав і", "прочитала і", "в мене ігнор"],
  toxic_person: ["токсичн", "абʼюз", "абюз", "газлайт", "маніпул", "манипул"],
  family_boundaries: ["свекр", "теща", "тесть", "родич", "лізуть", "лезут", "мама каже", "мама говорит", "батьки", "родители"],
  friendship: ["подруг", "друз", "друг ", "дружб"],
  loneliness: ["самотн", "одинок", "нікому не потрібн", "никому не нужн"],
  work: ["робот", "работ", "офіс", "офис", "проєкт", "проект", "звіт", "отчет", "колег"],
  boss: ["начальн", "шеф", "бос", "керівни", "руководит", "директор"],
  client: ["клієнт", "клиент", "замовни", "заказчик", "правк", "логотип", "тз "],
  deadline: ["дедлайн", "терміново", "срочно", "на вчора", "на вчера", "не встига", "не успева"],
  overload: ["завал", "забагато", "слишком много", "все на мені", "все на мне", "розриваюсь", "разрываюсь"],
  procrastination: ["відклада", "отклады", "прокрастин", "потім зроблю", "потом сделаю"],
  starting_problem: ["не можу почати", "не могу начать", "не можу зібратись", "не могу собраться"],
  motivation: ["мотивац", "нічого не хочу", "ничего не хочу", "нема сил", "нет сил"],
  money: ["грош", "деньг", "бабк", "зарплат", "бюджет", "гривн", "долар", "доллар"],
  debt: ["борг", "долг", "кредит", "позик", "розстрочк", "рассрочк"],
  low_income: ["мало заробля", "мало зарабатыва", "мала зарплат", "маленька зарплат", "копійк", "копейк"],
  high_prices: ["ціни ", "цін ", "ціна ", "ціну ", "ціною ", "цены ", "цен ", "цена ", "цену ", "дорого", "подорожча", "подорожа"],
  purchase_frustration: ["хочу купити", "хочу купить", "не можу купити", "не могу купить", "знижк", "скидк"],
  weight: ["вага", "вагу", "вес ", "схуд", "похуд", "кілограм", "килограм", "товст"],
  body_image: ["дзеркал", "зеркал", "некрасив", "негарн", "тіло", "тело", "зовнішн", "внешност"],
  diet: ["дієт", "диет", "калор", "не можна їсти", "нельзя есть"],
  low_energy: ["втомил", "устал", "виснаж", "истощ", "без сил", "батарейк"],
  sleep: ["не сплю", "не спл", "безсон", "бессон", "не висипа", "не высыпа", "сон "],
  parental_overload: ["дитин", "ребен", "діти", "дітей", "дети", "детей", "декрет"],
  mess: ["безлад", "бардак", "срач", "прибиран", "уборк", "посуд"],
  no_time_for_self: ["нема часу", "нет времени", "на себе часу", "на себя времени"],
  social_media: ["інстаграм", "инстаграм", "тікток", "тикток", "соцмереж", "соцсет", "рілс", "рилс"],
  comparison: ["порівню", "сравнива", "в інших", "у других", "у всіх", "у всех"],
  success_comparison: ["успішн", "успешн", "досяг", "добил", "а я ще", "а я еще"],
  hate_job: ["ненавиджу роботу", "ненавижу работу", "ненавиджу свою роботу", "бісить робота"],
  quit_impulse: ["звільню", "звільнит", "уволю", "уволит", "напишу заяв", "кину все"],
  text_ex: ["написати колишн", "написать бывш", "хочу йому написати", "хочу ей написать", "хочу їй написати"],
  argument_impulse: ["хочу відповісти", "хочу ответить", "хочу висловити", "хочу высказать", "все йому скажу", "все ей скажу"],
  prove_something: ["довести", "доказать", "покажу їм", "покажу им"],
  not_understood: ["не розуміють", "не понимают", "не чують", "не слышат", "не так зрозумі"],
  not_appreciated: ["не цінують", "не ценят", "не помічають", "не замечают", "ніхто не дякує", "никто не благодарит"],
  plans_failed: ["плани", "планы", "зірвал", "сорвал", "скасувал", "отменил", "не вийшло", "не получилось"],
  mistake: ["помилк", "ошибк", "облажал", "накосячи", "накосяч"],
  shame: ["сором", "стыд", "соромно", "стыдно", "ганьб", "позор"],
  self_anger: ["злюсь на себе", "злюсь на себя", "ненавиджу себе", "ненавижу себя", "я ідіот", "я идиот", "я дура", "я дурак"],
  numbness: ["нічого не відчуваю", "ничего не чувствую", "пусто", "порожн", "байдуже", "все равно"],
};

const EMOTION_HINTS: [Emotion, string[]][] = [
  ["anger", ["бісить", "бесит", "злюсь", "злий", "зла ", "дратує", "раздража", "ненавиджу", "ненавижу", "задовбал", "заебал", "заїбал", "достал", "дістал"]],
  ["anxiety", ["тривож", "тревож", "хвилю", "волну", "переживаю", "нервую"]],
  ["fear", ["страшно", "боюсь", "боюся", "лякає", "пугает"]],
  ["exhaustion", ["втомил", "устал", "виснаж", "без сил", "нема сил", "нет сил"]],
  ["sadness", ["сумно", "грустно", "плачу", "плакать", "плакати"]],
  ["loneliness", ["самотн", "одинок"]],
  ["shame", ["сором", "стыд"]],
  ["numbness", ["пусто", "байдуже", "все равно", "нічого не відчуваю"]],
  ["overwhelm", ["завал", "забагато", "не встига", "не успева"]],
];

// Емоція за замовчуванням для теми, якщо в тексті немає явних підказок.
const DEFAULT_EMOTION: Partial<Record<CategoryId, Emotion>> = {
  war: "anger", air_raid: "exhaustion", fear_for_family: "fear", uncertainty: "anxiety",
  loneliness: "loneliness", money: "anxiety", debt: "anxiety", shame: "shame", numbness: "numbness",
  overload: "overwhelm", deadline: "overwhelm", low_energy: "exhaustion", sleep: "exhaustion",
};

const SWEARS = ["бля", "хуй", "хуйн", "пізд", "пизд", "єба", "еба", "заїба", "заеба", "сука", "нахуй", "нахер", "срань", "дерьм", "лайн"];

/** Основа з пробілом у кінці — лише ціле слово; без пробілу — початок слова. Текст уже нормалізований. */
function hasStem(text: string, stem: string): boolean {
  return text.includes(` ${stem}`);
}

function detectIntensity(raw: string, normalized: string): number {
  let score = 5;
  const exclamations = (raw.match(/!/g) ?? []).length;
  score += Math.min(exclamations, 6) / 2;
  const letters = raw.replace(/[^\p{L}]/gu, "");
  const upper = letters.replace(/[^\p{Lu}]/gu, "").length;
  if (letters.length > 12 && upper / letters.length > 0.5) score += 2;
  if (SWEARS.some((s) => hasStem(normalized, s))) score += 1.5;
  if (raw.length > 600) score += 1;
  return Math.max(1, Math.min(10, Math.round(score)));
}

function detectEmotion(normalized: string): Emotion | undefined {
  let best: { emotion: Emotion; hits: number } | undefined;
  for (const [emotion, stems] of EMOTION_HINTS) {
    const hits = stems.filter((s) => hasStem(normalized, s)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { emotion, hits };
  }
  return best?.emotion;
}

export function classifyLocally(text: string) {
  const normalized = normalizeForMatching(text);
  const intensity = detectIntensity(text, normalized);
  const textEmotion = detectEmotion(normalized);

  const scored = (Object.entries(KEYWORDS) as [CategoryId, string[]][])
    .map(([category, stems]) => ({ category, hits: stems.filter((s) => hasStem(normalized, s)).length }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 5);

  const categories: CategoryId[] =
    scored.length === 0 ? ["unknown"] : scored.length >= 5 ? ["everything", ...scored.map((s) => s.category)] : scored.map((s) => s.category);

  const topics = categories.map((category, i) => ({
    category,
    label: SCENARIOS[category].label,
    emotion: textEmotion ?? DEFAULT_EMOTION[category] ?? "frustration",
    intensity: Math.max(1, intensity - i),
  }));

  const first = topics[0]!;
  const tone: Tone = first.emotion === "numbness" || first.emotion === "sadness" ? "quiet" : first.emotion === "anger" ? "direct" : "soft";

  return {
    topics,
    primary_emotion: first.emotion,
    recommended_mechanic: SCENARIOS[first.category].mechanic,
    tone,
  };
}

export const mockClassifier: RantClassifier = {
  id: "mock",
  async classify(text, { signal }) {
    // Невелика затримка, щоб UI-стани «аналізую» поводились як із мережею.
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 450);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(signal.reason);
      });
    });
    return classifyLocally(text);
  },
};
