/** Групи варіантів складу позиції (бісквіт, начинки тощо). Зберігаються в products.options як JSON. */
export type OptionGroup = { key: string; label: string; choices: string[]; required?: boolean };

export function parseOptions(s: string | null | undefined): OptionGroup[] {
  try {
    const v = JSON.parse(s || "[]");
    if (!Array.isArray(v)) return [];
    return v.filter((g) => g && typeof g.label === "string" && Array.isArray(g.choices)).map((g, i) => ({
      key: String(g.key || `g${i}`), label: String(g.label), choices: g.choices.map(String).filter(Boolean), required: !!g.required,
    }));
  } catch { return []; }
}

/** Текстовий формат для адмінки: по одній групі в рядку — `Назва: варіант, варіант`. Зірочка на початку = обов'язково. */
export function optionsToText(groups: OptionGroup[]): string {
  return groups.map((g) => `${g.required ? "*" : ""}${g.label}: ${g.choices.join(", ")}`).join("\n");
}
export function textToOptions(text: string): OptionGroup[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean).flatMap((line, i) => {
    const required = line.startsWith("*");
    const body = required ? line.slice(1) : line;
    const idx = body.indexOf(":");
    if (idx < 1) return [];
    const label = body.slice(0, idx).trim();
    const choices = body.slice(idx + 1).split(",").map((c) => c.trim()).filter(Boolean);
    if (!label || choices.length === 0) return [];
    return [{ key: `g${i}-${label.toLowerCase().replace(/[^a-zа-яіїєґ0-9]+/gi, "-")}`, label, choices, required }];
  });
}

/** Стартовий набір складу від Дар'ї — використовується для бенто та торта за власним складом. */
export const COMPOSITION: OptionGroup[] = [
  { key: "biscuit", label: "Бісквіт", required: true, choices: ["ванільний", "шоколадний", "лимонний", "червоний оксамит", "маковий", "морквяний", "горіховий", "мигдалево-кокосовий", "шпинатний", "м’ятний", "медовий"] },
  { key: "curd", label: "Курд (на основі фрешу)", choices: ["лимонний", "апельсиновий (кисло-солодкий)"] },
  { key: "confiture", label: "Конфітюр", choices: ["полуниця", "вишня", "малина", "персик", "лісова ягода", "чорна смородина (кисло-солодка)"] },
  { key: "mousse", label: "Мус (вершки та шоколад)", choices: ["молочний шоколад", "білий шоколад", "чорний шоколад", "кокосовий", "м’ятний", "банановий", "полуничний", "вишневий", "малиновий", "ягідний", "персиковий"] },
  { key: "caramel", label: "Карамель", choices: ["звичайна", "солона", "звичайна з арахісом", "звичайна з фундуком", "солона з арахісом", "солона з фундуком", "звичайна з бананом", "солона з бананом"] },
  { key: "crunch", label: "Хрусткий прошарок", choices: ["вафля кондитерська", "арахіс", "фундук", "мигдаль", "білий шоколад", "молочний шоколад", "чорний шоколад"] },
];
