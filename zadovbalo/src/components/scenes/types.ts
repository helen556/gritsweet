import type { Currency } from "@/lib/topics";

export type Intensity = 1 | 2 | 3;

/** Дані, що сцена отримує з потоку (уже підтверджені людиною). */
export interface SceneInput {
  amount?: number;
  currency?: Currency | null;
  /** Короткі назви (задачі для рюкзака, фрази для наліпок). */
  labels?: string[];
}

export interface SceneProps {
  input: SceneInput;
  intensity: Intensity;
  reducedMotion: boolean;
  /** Сцена дійшла природного кінця (сума = 0, рюкзак порожній…). Не примус — лише сигнал оболонці. */
  onSettled: () => void;
  /** Змінити підказку внизу. */
  setHint: (hint: string) => void;
}
