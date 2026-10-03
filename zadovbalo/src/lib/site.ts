export const SITE = {
  name: "Задовбало",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  title: "Задовбало — вивали все, що накипіло",
  description:
    "Задовбало? Напиши або надиктуй усе, що бісить, — і за пару хвилин випусти пару: рви, стирай, відкидай. Без діагнозів і психологічних лекцій. Матюкатись можна.",
  locale: "uk_UA",
} as const;
