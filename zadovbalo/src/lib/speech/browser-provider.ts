"use client";

import { SpeechError, type SpeechProvider, type SpeechStartOptions } from "./types";

// Мінімальні типи Web Speech API (немає в lib.dom).
interface RecognitionAlternative { transcript: string }
interface RecognitionResult { isFinal: boolean; 0: RecognitionAlternative; length: number }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface RecognitionErrorEvent { error: string }
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

function mapError(code: string): SpeechError | null {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return new SpeechError("permission_denied");
    case "audio-capture":
      return new SpeechError("no_microphone");
    case "network":
      return new SpeechError("network");
    case "no-speech":
    case "aborted":
      return null;
    default:
      return new SpeechError("unavailable");
  }
}

/** Web Speech API. У Chrome розпізнавання виконують сервери Google, у Safari — Apple. */
export function createBrowserSpeechProvider(): SpeechProvider {
  let recognition: Recognition | null = null;
  let finalText = "";
  let active = false;
  let failure: SpeechError | null = null;
  let onEnded: (() => void) | null = null;

  const transcript = () => finalText.replace(/\s+/g, " ").trim();

  return {
    id: "browser",
    isSupported: () => Boolean(getCtor()) && Boolean(navigator.mediaDevices?.getUserMedia),

    async start({ language, onPartial }: SpeechStartOptions) {
      const Ctor = getCtor();
      if (!Ctor) throw new SpeechError("unavailable");
      finalText = "";
      failure = null;
      active = true;

      const run = () => {
        const r = new Ctor();
        r.lang = language;
        r.continuous = true;
        r.interimResults = true;
        r.onresult = (event) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (!result) continue;
            if (result.isFinal) finalText += ` ${result[0].transcript}`;
            else interim += ` ${result[0].transcript}`;
          }
          onPartial?.(`${transcript()} ${interim}`.trim());
        };
        r.onerror = (event) => {
          const error = mapError(event.error);
          if (error) {
            failure = error;
            active = false;
          }
        };
        r.onend = () => {
          // Браузери самі зупиняють розпізнавання після паузи — перезапускаємо, поки користувач не натиснув «Стоп».
          if (active) {
            try {
              run();
              return;
            } catch {
              active = false;
            }
          }
          recognition = null;
          onEnded?.();
        };
        recognition = r;
        r.start();
      };

      run();
    },

    stop() {
      return new Promise<string>((resolve, reject) => {
        const finish = () => (failure ? reject(failure) : resolve(transcript()));
        active = false;
        if (!recognition) return finish();
        onEnded = () => {
          onEnded = null;
          finish();
        };
        recognition.stop();
      });
    },

    cancel() {
      active = false;
      onEnded = null;
      recognition?.abort();
      recognition = null;
      finalText = "";
    },
  };
}
