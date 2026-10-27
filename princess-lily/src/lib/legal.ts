import "server-only";
import { getSettings } from "./settings";

/**
 * Публічна оферта й політика конфіденційності публікуються лише після того, як власниця заповнила реквізити
 * продавця й строк зберігання даних і позначила тексти погодженими (адмінка → Налаштування).
 * До того відвідувач бачить коротку примітку «документ готується» — без чернетки й заглушок на кшталт «[заповнити]».
 */
export async function legalStatus() {
  const s = await getSettings();
  const missing = [
    !s.seller_details_uk.trim() && "реквізити продавця (укр.)",
    !s.seller_details_en.trim() && "реквізити продавця (англ.)",
    !s.legal_retention_uk.trim() && "строк зберігання даних (укр.)",
    !s.legal_retention_en.trim() && "строк зберігання даних (англ.)",
    !s.contact_email.trim() && "email для зв’язку",
  ].filter(Boolean) as string[];
  return { ready: !missing.length && s.legal_approved === "1", approved: s.legal_approved === "1", missing, settings: s };
}
