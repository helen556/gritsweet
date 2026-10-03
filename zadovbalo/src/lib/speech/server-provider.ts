"use client";

import { SpeechError, type SpeechProvider, type SpeechStartOptions } from "./types";

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/** Запис у браузері → /api/transcribe. Аудіо існує лише в пам’яті до відповіді сервера. */
export function createServerSpeechProvider(): SpeechProvider {
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];

  return {
    id: "server",
    isSupported: () => typeof window !== "undefined" && "MediaRecorder" in window && Boolean(navigator.mediaDevices?.getUserMedia),

    async start({ stream }: SpeechStartOptions) {
      const mimeType = MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
      chunks = [];
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.start(1000);
    },

    stop() {
      return new Promise<string>((resolve, reject) => {
        const r = recorder;
        if (!r) return reject(new SpeechError("unavailable"));
        r.onstop = async () => {
          const audio = new Blob(chunks, { type: r.mimeType });
          chunks = [];
          recorder = null;
          try {
            const form = new FormData();
            form.append("audio", audio);
            const res = await fetch("/api/transcribe", { method: "POST", body: form });
            if (!res.ok) return reject(new SpeechError(res.status >= 500 && res.status !== 501 ? "network" : "unavailable"));
            const data = (await res.json()) as { text?: unknown };
            resolve(typeof data.text === "string" ? data.text.trim() : "");
          } catch {
            reject(new SpeechError("network"));
          }
        };
        r.stop();
      });
    },

    cancel() {
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      recorder = null;
      chunks = [];
    },
  };
}
