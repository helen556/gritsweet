"use client";

import { createBrowserSpeechProvider } from "./browser-provider";
import { createServerSpeechProvider } from "./server-provider";
import type { SpeechProvider } from "./types";

export function createSpeechProvider(): SpeechProvider {
  return process.env.NEXT_PUBLIC_SPEECH_PROVIDER === "server" ? createServerSpeechProvider() : createBrowserSpeechProvider();
}

export * from "./types";

/** Чи доступний голосовий ввід на цьому пристрої (без побічних ефектів). */
export function isSpeechInputSupported(): boolean {
  return createSpeechProvider().isSupported();
}
