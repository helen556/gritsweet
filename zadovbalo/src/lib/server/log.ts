import "server-only";

/**
 * Структуровані логи (JSON на рядок). Сюди НІКОЛИ не передаємо текст користувача, аудіо чи секрети:
 * тип полів навмисно обмежений примітивами з відомим змістом.
 */
export interface LogEvent {
  requestId: string;
  route: string;
  status: number;
  /** Машинний код помилки або події, напр. "timeout", "rate_limited". */
  type: string;
  durationMs?: number;
  /** Агреговані лічильники/коди без вмісту. */
  meta?: Record<string, string | number | boolean>;
}

export function logEvent(level: "info" | "warn" | "error", event: LogEvent) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, ...event });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
