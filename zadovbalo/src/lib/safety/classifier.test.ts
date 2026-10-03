import { describe, expect, it } from "vitest";
import { assessSafety } from "./classifier";

describe("assessSafety", () => {
  it.each([
    "Я більше не хочу жити",
    "думаю покінчити з собою",
    "хочу вбити себе",
    "Я вб’ю себе, якщо так буде далі",
    "Хочу померти, все задовбало",
    "наковтатися таблеток і все",
    "не хочу жить уже",
    "I want to kill myself",
  ])("crisis for self-harm: %s", (text) => {
    const r = assessSafety(text);
    expect(r.level).toBe("crisis");
    expect(r.reasons).toContain("self_harm");
  });

  it.each([
    "Я його вб'ю ножем, вже купив",
    "завтра вранці застрелю сусіда, є план",
    "заріжу його, знаю де він живе",
  ])("crisis for concrete harm to others: %s", (text) => {
    const r = assessSafety(text);
    expect(r.level).toBe("crisis");
    expect(r.reasons).toContain("harm_to_others");
  });

  it.each(["Він мене б’є", "мене зараз б'ють", "мені зараз небезпечно"])("crisis for immediate danger: %s", (text) => {
    expect(assessSafety(text).reasons).toContain("immediate_danger");
  });

  it.each(["Шеф бісить, я його вб'ю", "клієнт, я тебе приб'ю з цими правками"])("caution for hyperbole: %s", (text) => {
    expect(assessSafety(text)).toEqual({ level: "caution", reasons: [] });
  });

  it.each([
    "Задовбала робота, клієнт знову хоче більший логотип",
    "Більше, ніж будь-коли, хочу у відпустку",
    "Мене все бісить, ціни, борги, і ще колишній пише",
    "Ця ніжність мене вбиває",
  ])("none for ordinary venting: %s", (text) => {
    expect(assessSafety(text).level).toBe("none");
  });
});
