import type { SceneId } from "@/lib/scenes/registry";
import type { Currency } from "@/lib/topics";

/** Дані, що сцена отримує з потоку (уже підтверджені людиною). */
export interface SceneInput {
  amount?: number;
  currency?: Currency | null;
  /** Короткі підписи (камені рюкзака). */
  labels?: string[];
}

export interface SceneProps {
  input: SceneInput;
  reducedMotion: boolean;
  /** Сцена дійшла природного кінця (сума = 0, клубок змотано…). Не примус — лише сигнал оболонці. */
  onSettled: () => void;
  /** Змінити підказку внизу. */
  setHint: (hint: string) => void;
  /** Перша взаємодія: вступ згортається. */
  onInteract: () => void;
  /** Відкрити мʼяке завершення (кнопка «Завершити» всередині сцени). */
  onFinish: () => void;
  /** Змінити дані налаштування (суму) без повторного вибору теми. */
  onEditInput?: () => void;
  /** Перейти до іншої сцени (напр. «Хочу тихішу сцену»). */
  onSwitch?: (id: SceneId) => void;
}
