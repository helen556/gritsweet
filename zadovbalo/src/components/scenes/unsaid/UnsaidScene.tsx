"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { sound } from "@/lib/scene/sound";
import type { SceneProps } from "../types";

type Status = "sending" | "delivered" | "read";
interface Msg {
  id: number;
  text: string;
  time: string;
  status: Status;
}

const MAX = 2000;

/**
 * «Те, що не встигла сказати» — приватна симуляція знайомого чату.
 * Нікуди нічого не надсилається: ні на сервер, ні в AI, ні в аналітику чи журнали.
 * Текст живе лише в стані цього компонента й зникає разом зі сценою.
 */
export default function UnsaidScene({
  reducedMotion,
  setHint,
  onInteract,
  onFinish,
}: SceneProps) {
  const id = useId();
  const [to, setTo] = useState("");
  const [draft, setDraft] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [kb, setKb] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timers = useRef<number[]>([]);
  const seq = useRef(0);

  // Мобільна клавіатура: піднімаємо поле над нею (visualViewport), щоб нічого не ховалося.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () =>
      setKb(
        Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)),
      );
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);

  useEffect(
    () => () => timers.current.forEach((t) => window.clearTimeout(t)),
    [],
  );

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el)
      el.scrollTo({
        top: el.scrollHeight,
        behavior: reducedMotion ? "auto" : "smooth",
      });
  }, [msgs, reducedMotion]);

  const setStatus = (mid: number, status: Status) =>
    setMsgs((all) => all.map((m) => (m.id === mid ? { ...m, status } : m)));

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onInteract();
    const mid = ++seq.current;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setMsgs((all) => [...all, { id: mid, text, time, status: "sending" }]);
    setDraft("");
    sound.play("soft", 0.4);
    // Символічні статуси, послідовно. Реального отримувача немає.
    timers.current.push(
      window.setTimeout(
        () => setStatus(mid, "delivered"),
        reducedMotion ? 300 : 900,
      ),
    );
    timers.current.push(
      window.setTimeout(
        () => {
          setStatus(mid, "read");
          setHint(
            "«Прочитано» — символічний стан цієї вправи. Можна написати ще або завершити.",
          );
        },
        reducedMotion ? 900 : 2300,
      ),
    );
    inputRef.current?.focus();
  };

  const last = msgs[msgs.length - 1];
  const name = to.trim();

  return (
    <div
      className="flex h-full justify-center px-2 pb-1 sm:px-4"
      style={{ paddingBottom: kb ? kb : undefined }}
    >
      <div className="flex h-full w-full max-w-lg flex-col overflow-hidden rounded-[14px] border border-white/8 bg-[#17212b] shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)]">
        {/* Шапка чату */}
        <div className="flex items-center gap-3 border-b border-black/30 bg-[#232e3c] px-3 py-2">
          <div
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#6c7883] to-[#4d5965] text-base font-medium text-white"
          >
            {name ? name.slice(0, 1).toUpperCase() : <PersonIcon />}
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor={`${id}-to`} className="sr-only">
              Кому ці слова? (необовʼязково)
            </label>
            <input
              id={`${id}-to`}
              value={to}
              maxLength={40}
              onChange={(e) => setTo(e.target.value)}
              placeholder="Кому ці слова?"
              autoComplete="off"
              className="w-full truncate bg-transparent text-[0.98rem] font-medium text-white placeholder:text-[#8d9aa6] focus-visible:outline-none"
            />
            <p className="text-[0.7rem] leading-tight text-[#8d9aa6]">
              Приватна візуалізація · повідомлення нікому не надсилається
            </p>
          </div>
        </div>

        {/* Стрічка */}
        <div
          ref={listRef}
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
          style={{
            backgroundColor: "#0e1621",
            backgroundImage:
              "radial-gradient(rgb(255 255 255 / 0.035) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
          aria-live="polite"
          aria-label="Повідомлення"
        >
          <div className="mx-auto mb-3 w-fit rounded-full bg-black/35 px-3 py-0.5 text-[0.72rem] text-white/75">
            Сьогодні
          </div>
          {msgs.length === 0 && (
            <p className="mx-auto mt-10 max-w-xs text-balance text-center text-sm text-white/55">
              Тут можна написати після образи, незавершеної розмови чи людині,
              якої вже немає. Ніхто, крім тебе, цього не побачить.
            </p>
          )}
          <ul className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {msgs.map((m) => (
                <motion.li
                  key={m.id}
                  layout={!reducedMotion}
                  initial={
                    reducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: 46, scale: 0.92 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  style={{ originX: 1, originY: 1 }}
                  className="flex justify-end"
                >
                  <div className="relative max-w-[85%] rounded-[16px] rounded-br-[5px] bg-[#2b5278] px-3 pb-1.5 pt-2 text-[0.97rem] leading-snug text-white shadow-[0_1px_1px_rgb(0_0_0/0.25)]">
                    <p className="whitespace-pre-wrap break-words pr-14">
                      {m.text}
                    </p>
                    <span className="absolute bottom-1 right-2 flex items-center gap-1 text-[0.68rem] text-[#a5c4e2]">
                      {m.time}
                      <Ticks status={m.status} reducedMotion={reducedMotion} />
                    </span>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {last && (
            <p className="mt-1 text-right text-[0.72rem] text-white/55">
              {last.status === "sending"
                ? "Надсилання…"
                : last.status === "delivered"
                  ? "Доставлено"
                  : "Прочитано"}
              <span className="sr-only">
                . Статус символічний, повідомлення нікуди не надсилалося.
              </span>
            </p>
          )}
          {last?.status === "read" && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <p className="text-center text-[0.75rem] text-white/50">
                «Прочитано» — символічний стан цієї вправи
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.focus()}
                  className="min-h-10 rounded-full bg-white/10 px-4 text-sm text-white hover:bg-white/15"
                >
                  Написати ще
                </button>
                <button
                  type="button"
                  onClick={onFinish}
                  className="min-h-10 rounded-full bg-white/10 px-4 text-sm text-white hover:bg-white/15"
                >
                  Завершити
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Поле вводу */}
        <form
          className="flex items-end gap-2 border-t border-black/30 bg-[#17212b] px-2 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label htmlFor={`${id}-m`} className="sr-only">
            Повідомлення
          </label>
          <textarea
            id={`${id}-m`}
            ref={inputRef}
            value={draft}
            maxLength={MAX}
            rows={1}
            onFocus={onInteract}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // На компʼютері Enter — надіслати, Shift+Enter — новий рядок.
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !("ontouchstart" in window)
              ) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Повідомлення"
            lang="uk"
            className="field-sizing-content max-h-36 min-h-11 flex-1 resize-none rounded-[20px] bg-[#242f3d] px-4 py-2.5 text-[1rem] leading-snug text-white placeholder:text-[#6d7f8f] focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Надіслати"
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-full transition-colors",
              draft.trim()
                ? "bg-[#5288c1] text-white"
                : "bg-transparent text-[#6d7f8f]",
            )}
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  );
}

function Ticks({
  status,
  reducedMotion,
}: {
  status: Status;
  reducedMotion: boolean;
}) {
  if (status === "sending")
    return (
      <svg
        viewBox="0 0 16 16"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        aria-hidden
      >
        <circle cx="8" cy="8" r="6" />
        <path d="M8 4.5V8l2.2 1.4" strokeLinecap="round" />
      </svg>
    );
  const read = status === "read";
  return (
    <svg
      viewBox="0 0 20 12"
      className={cn("h-3 w-5", read ? "text-[#6ab3f3]" : "text-[#a5c4e2]")}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <motion.path
        d="M1.5 6.5l3.2 3.2L11 2.5"
        initial={reducedMotion ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3 }}
      />
      {read && (
        <motion.path
          d="M7.5 9.7L14.5 2.5"
          initial={reducedMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.3 }}
        />
      )}
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden>
      <path d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a.993.993 0 0 0-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3.3 0-8 1.7-8 5v1h16v-1c0-3.3-4.7-5-8-5z" />
    </svg>
  );
}
