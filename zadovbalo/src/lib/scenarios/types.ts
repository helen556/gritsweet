import type { CategoryId } from "@/lib/topics/categories";
import type { ImplementedMechanic } from "@/lib/mechanics/registry";
import type { MechanicType } from "@/lib/mechanics/types";

export interface ScenarioCopy {
  /** Велике слово/фраза над механікою. */
  title: string;
  /** Коротка підказка, що робити. */
  hint: string;
  /** Після завершення. */
  done: string;
}

export interface Scenario {
  category: CategoryId;
  /** Підпис чипа, капслоком. */
  label: string;
  mechanic: MechanicType;
  /** Чим грати, поки окремий компонент `mechanic` ще не готовий. За замовчуванням — swipe_away. */
  fallback?: ImplementedMechanic;
  /** Неруйнівна заміна, якщо safety-шар бачить агресивні формулювання. За замовчуванням — dismiss. */
  cautionMechanic?: MechanicType;
  /** Ідентифікатор графічного об’єкта механіки (карта, кабель, стіл…). */
  asset: string;
  /** Що саме прибираємо / сортуємо / стираємо. */
  items: readonly string[];
  /** Скільки елементів залишити (наприклад, 3 задачі з 20). */
  keep?: number;
  /** Кошики для sort. */
  buckets?: readonly string[];
  /** Брати елементи з тем, які знайшов класифікатор (для «все й одразу»). */
  itemsFrom?: "topics";
  copy: ScenarioCopy;
}
