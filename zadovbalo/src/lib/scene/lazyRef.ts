"use client";

import { useRef, type RefObject } from "react";

/**
 * Змінний стан симуляції (фізика, частинки, поле висот), створений один раз.
 * Ініціалізатор — функція, тож обʼєкт не вважається «аргументом хука» й його можна змінювати.
 */
export function useLazyRef<T>(init: () => T): RefObject<T> {
  const ref = useRef<T | null>(null);
  if (ref.current === null) ref.current = init();
  return ref as RefObject<T>;
}
