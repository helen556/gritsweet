import "server-only";

/**
 * Серверне розпізнавання мовлення. Аудіо обробляється в пам’яті й ніде не зберігається.
 * Новий провайдер = запис у SERVER_TRANSCRIBERS, ключ — лише серверна змінна середовища.
 */
export interface ServerTranscriber {
  readonly id: string;
  transcribe(audio: Blob, options: { language: string; signal: AbortSignal }): Promise<string>;
}

const SERVER_TRANSCRIBERS: Record<string, () => ServerTranscriber> = {};

export function getServerTranscriber(): ServerTranscriber | null {
  const id = process.env.SPEECH_PROVIDER?.trim().toLowerCase();
  if (!id) return null;
  return SERVER_TRANSCRIBERS[id]?.() ?? null;
}
