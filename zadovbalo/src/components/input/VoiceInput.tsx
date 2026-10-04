"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { useReveal } from "@/components/ui/motion";
import { StageHeading, StagePanel } from "@/components/flow/StagePanel";
import { MicIcon } from "@/components/hero/Compose";
import type { SpeechErrorCode } from "@/lib/speech";
import { useVoiceRecorder } from "./useVoiceRecorder";
import { Waveform } from "./Waveform";

const ERRORS: Record<SpeechErrorCode, { title: string; text: string }> = {
  permission_denied: {
    title: "Без мікрофона ніяк.",
    text: "Доступ заборонено. Його можна ввімкнути в налаштуваннях браузера — або просто напиши.",
  },
  no_microphone: { title: "Мікрофон не знайдено.", text: "Підключи мікрофон або напиши текстом." },
  network: { title: "Щось зависло. Не ти — сайт.", text: "Розпізнаванню забракло звʼязку." },
  unavailable: { title: "Розпізнавання зараз не працює.", text: "Можна спробувати ще раз або написати." },
  no_speech: { title: "Нічого не почули.", text: "Спробуй ще раз — ближче до мікрофона." },
};

const SERVER_STT = process.env.NEXT_PUBLIC_SPEECH_PROVIDER === "server";

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function VoiceInput({ onTranscript, onWrite }: { onTranscript: (text: string) => void; onWrite: () => void }) {
  const r = useReveal();
  const rec = useVoiceRecorder();

  useEffect(() => {
    if (rec.state === "success" && rec.transcript) onTranscript(rec.transcript);
  }, [rec.state, rec.transcript, onTranscript]);

  if (rec.state === "unsupported") {
    return (
      <StagePanel label="Голосовий ввід" className="gap-8">
        <motion.div {...r.word(0, 1)}>
          <StageHeading size="title" className="max-w-2xl">
            На цьому пристрої голосовий ввід недоступний. Можеш написати.
          </StageHeading>
        </motion.div>
        <motion.div {...r.rise(0.3)}>
          <Button size="lg" onClick={onWrite}>
            Написати
          </Button>
        </motion.div>
      </StagePanel>
    );
  }

  const error = rec.state === "error" && rec.error ? ERRORS[rec.error] : null;
  const recording = rec.state === "recording";
  const title = error?.title ?? (rec.state === "requesting-permission" ? "Дозволь мікрофон." : rec.state === "processing" ? "Секунду…" : "Говори.");

  return (
    <StagePanel label="Голосовий ввід" className="gap-7">
      <AnimatePresence mode="wait">
        <motion.div key={title} {...r.word(0, 0.9)}>
          <StageHeading size={error ? "title" : "giant"} className={error ? "max-w-2xl" : undefined}>
            {title}
          </StageHeading>
        </motion.div>
      </AnimatePresence>

      <div aria-live="polite" className="flex min-h-28 w-full max-w-2xl flex-col items-center gap-4">
        {error && <p className="text-lede max-w-xl text-balance text-frost/85">{error.text}</p>}

        {recording && (
          <>
            <Waveform stream={rec.stream} reduced={r.reduced} />
            <p className="font-sans text-sm tabular-nums tracking-[0.12em] text-mist">
              <span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-ember align-middle" aria-hidden />
              <span className="sr-only">Іде запис. </span>
              {formatTime(rec.elapsed)} / {formatTime(rec.maxDuration)}
            </p>
            {rec.partial && (
              <p className="max-h-32 w-full overflow-y-auto text-balance text-lg leading-relaxed text-frost/80">{rec.partial}</p>
            )}
          </>
        )}

        {rec.state === "processing" && <p className="text-mist">Перетворюю на текст.</p>}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {(rec.state === "idle" || rec.state === "error" || rec.state === "success") && (
          <Button size="lg" onClick={() => void rec.start()} className="min-w-52">
            <MicIcon />
            {rec.state === "idle" ? "Почати запис" : "Спробувати ще раз"}
          </Button>
        )}
        {recording && (
          <>
            <Button size="lg" onClick={() => void rec.stop()} className="min-w-44">
              <span aria-hidden className="size-3 rounded-[1px] bg-abyss" />
              Готово
            </Button>
            <Button size="lg" variant="ghost" onClick={rec.cancel}>
              Скасувати
            </Button>
          </>
        )}
        {rec.state === "requesting-permission" && (
          <Button size="lg" variant="ghost" onClick={rec.cancel}>
            Скасувати
          </Button>
        )}
        {!recording && rec.state !== "processing" && (
          <Button variant="quiet" onClick={onWrite}>
            Краще напишу
          </Button>
        )}
      </div>

      <div className="max-w-md space-y-1 text-xs leading-relaxed text-mist/85">
        <p>Голос використовується лише для перетворення в текст. Запис не зберігається після обробки.</p>
        {!SERVER_STT && <p className="text-mist/65">Розпізнає твій браузер: Chrome — через сервіс Google, Safari — через Apple.</p>}
      </div>
    </StagePanel>
  );
}
