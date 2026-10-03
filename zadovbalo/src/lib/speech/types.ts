export type SpeechState =
  | "idle"
  | "requesting-permission"
  | "recording"
  | "processing"
  | "success"
  | "error"
  | "unsupported";

export type SpeechErrorCode = "permission_denied" | "no_microphone" | "network" | "unavailable" | "no_speech";

export class SpeechError extends Error {
  constructor(readonly code: SpeechErrorCode) {
    super(code);
    this.name = "SpeechError";
  }
}

export interface SpeechStartOptions {
  /** Потік мікрофона, уже відкритий для хвилі. Провайдер може використати його або відкрити свій. */
  stream: MediaStream;
  language: string;
  /** Проміжний текст під час запису (якщо провайдер уміє). */
  onPartial?: (text: string) => void;
}

/**
 * Абстракція над розпізнаванням мовлення. UI працює лише з цим інтерфейсом,
 * тож браузерний Web Speech API можна замінити серверним STT без змін у компонентах.
 */
export interface SpeechProvider {
  readonly id: "browser" | "server";
  /** Чи має сенс показувати кнопку запису на цьому пристрої. */
  isSupported(): boolean;
  start(options: SpeechStartOptions): Promise<void>;
  /** Зупиняє запис і повертає фінальний текст. */
  stop(): Promise<string>;
  /** Скасовує все, результат відкидається. */
  cancel(): void;
}
