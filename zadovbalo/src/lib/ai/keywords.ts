import { normalizeForMatching } from "@/lib/safety/normalize";
import type { Category } from "@/lib/topics";

/**
 * Простий пошук ключових слів — лише як підказка в ручному виборі, коли AI недоступний.
 * Ніколи не подається як «AI розпізнав».
 */
const STEMS: Partial<Record<Category, string[]>> = {
  financial_debt: ["борг", "долг", "кредит", "позик", "іпотек", "ипотек", "розстрочк", "рассрочк", "грош", "деньг", "зарплат", "мікрозайм", "мфо"],
  overload: ["все на мені", "все на мне", "не встига", "не успева", "завал", "забагато", "слишком много", "розриваюсь", "разрываюсь", "тягну все", "тащу все"],
  rumination: ["думаю й думаю", "думки", "мысли", "по колу", "по кругу", "не можу перестати", "не могу перестать", "прокручую", "прокручиваю", "накручую"],
  anger: ["бісить", "бесит", "злюсь", "злий", "зла ", "лють", "ярост", "дратує", "раздража", "ненавиджу", "ненавижу", "задовбал", "заебал", "заїбал", "достал", "дістал"],
  hurtful_words: ["сказав", "сказала", "сказали", "назвав", "назвала", "обізвав", "обозвал", "образив", "образила", "обидел", "критику", "принизи", "униз"],
  control: ["контрол", "хаос", "вислизає", "ускольза", "не можу вплинути", "нічого не залежить", "ничего не зависит", "хочу паузу", "перепочити", "відпочити"],
  war_anger: ["рашист", "русн", "орки", "окупант", "путін", "путин", "росія", "россия", "кацап"],
};

const NEGATIONS = ["не ", "ні ", "нет ", "нi "];

export function keywordCategories(text: string): Category[] {
  const t = normalizeForMatching(text);
  const hits: { category: Category; score: number }[] = [];
  for (const [category, stems] of Object.entries(STEMS) as [Category, string[]][]) {
    let score = 0;
    for (const stem of stems) {
      const idx = t.indexOf(` ${stem}`);
      if (idx < 0) continue;
      // «я не злюсь» — не рахуємо
      const before = t.slice(Math.max(0, idx - 4), idx + 1);
      if (NEGATIONS.some((n) => before.endsWith(` ${n}`) || before.endsWith(n))) continue;
      score++;
    }
    if (score > 0) hits.push({ category, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 3).map((h) => h.category);
}
