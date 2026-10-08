import "server-only";
import { novaPoshtaKey } from "../config";

/**
 * Адаптер Нової пошти. Без NOVA_POSHTA_API_KEY — ручне введення міста й відділення (mode "manual").
 * Тариф не розраховуємо: доставку оплачує покупець за тарифами перевізника.
 */
export const novaPoshtaMode = () => (novaPoshtaKey() ? "api" : "manual");

type NpResponse<T> = { success: boolean; data: T[]; errors: string[] };
async function call<T>(modelName: string, calledMethod: string, methodProperties: Record<string, unknown>): Promise<T[]> {
  const r = await fetch("https://api.novaposhta.ua/v2.0/json/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey: novaPoshtaKey(), modelName, calledMethod, methodProperties }),
    signal: AbortSignal.timeout(8000),
  });
  const j = (await r.json()) as NpResponse<T>;
  if (!j.success) throw new Error("Nova Poshta API error");
  return j.data;
}
export async function searchCities(q: string) {
  if (novaPoshtaMode() !== "api" || q.trim().length < 2) return [];
  const d = await call<{ Description: string; Ref: string; AreaDescription: string }>("Address", "getCities", { FindByString: q.trim(), Limit: "20" });
  return d.map((c) => ({ ref: c.Ref, name: c.Description, area: c.AreaDescription }));
}
export async function searchPoints(cityRef: string, q: string) {
  if (novaPoshtaMode() !== "api" || !/^[0-9a-f-]{36}$/i.test(cityRef)) return [];
  const d = await call<{ Description: string; Ref: string }>("Address", "getWarehouses", { CityRef: cityRef, FindByString: q.trim(), Limit: "50" });
  return d.map((w) => ({ ref: w.Ref, name: w.Description }));
}
