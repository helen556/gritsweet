"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createSpeechProvider, isSpeechInputSupported, SpeechError, type SpeechErrorCode, type SpeechProvider, type SpeechState } from "@/lib/speech";

const MAX_DURATION_S = 180;
const noopSubscribe = () => () => {};

/**
 * Стан-машина голосового вводу поверх SpeechProvider.
 * idle → requesting-permission → recording → processing → success | error; unsupported — якщо API немає.
 * Потік мікрофона закривається одразу після зупинки; аудіо ніде не зберігається.
 */
export function useVoiceRecorder({ language = "uk-UA" }: { language?: string } = {}) {
  const providerRef = useRef<SpeechProvider | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const stopRef = useRef<() => Promise<void>>(async () => {});
  const [state, setState] = useState<SpeechState>("idle");
  const [error, setError] = useState<SpeechErrorCode | null>(null);
  const [partial, setPartial] = useState("");
  const [transcript, setTranscript] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const getProvider = () => (providerRef.current ??= createSpeechProvider());

  const releaseMic = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const fail = useCallback(
    (code: SpeechErrorCode) => {
      releaseMic();
      setError(code);
      setState("error");
    },
    [releaseMic],
  );

  const stop = useCallback(async () => {
    const provider = providerRef.current;
    if (!provider) return;
    setState("processing");
    releaseMic();
    try {
      const text = await provider.stop();
      if (!text.trim()) return fail("no_speech");
      setTranscript(text);
      setState("success");
    } catch (e) {
      fail(e instanceof SpeechError ? e.code : "unavailable");
    }
  }, [fail, releaseMic]);

  const start = useCallback(async () => {
    const provider = getProvider();
    if (!provider.isSupported()) return setState("unsupported");
    setError(null);
    setPartial("");
    setTranscript("");
    setElapsed(0);
    setState("requesting-permission");

    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      return fail(name === "NotAllowedError" || name === "SecurityError" ? "permission_denied" : name === "NotFoundError" ? "no_microphone" : "unavailable");
    }
    streamRef.current = media;
    setStream(media);

    try {
      await provider.start({ stream: media, language, onPartial: setPartial });
    } catch (e) {
      return fail(e instanceof SpeechError ? e.code : "unavailable");
    }
    setState("recording");
    const startedAt = Date.now();
    timerRef.current = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(seconds);
      // Ліміт тривалості.
      if (seconds >= MAX_DURATION_S) void stopRef.current();
    }, 250);
  }, [fail, language]);

  const cancel = useCallback(() => {
    providerRef.current?.cancel();
    releaseMic();
    setPartial("");
    setTranscript("");
    setError(null);
    setState("idle");
  }, [releaseMic]);

  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  // Підтримку знаємо лише в браузері; на сервері вважаємо, що є.
  const supported = useSyncExternalStore(noopSubscribe, isSpeechInputSupported, () => true);

  useEffect(
    () => () => {
      providerRef.current?.cancel();
      releaseMic();
    },
    [releaseMic],
  );

  return { state: supported ? state : ("unsupported" as const), error, partial, transcript, elapsed, stream, maxDuration: MAX_DURATION_S, start, stop, cancel };
}
