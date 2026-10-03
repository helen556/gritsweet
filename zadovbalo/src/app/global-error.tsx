"use client";

import "./globals.css";
import { fontVariables } from "./fonts";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="uk" className={fontVariables}>
      <body>
        <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-abyss px-4 text-center">
          <h1 className="font-display text-title font-medium text-frost">Щось зависло. Не ти — сайт.</h1>
          <button
            type="button"
            onClick={reset}
            className="min-h-14 rounded-[2px] bg-frost px-8 font-medium text-abyss hover:bg-white"
          >
            Спробувати ще раз
          </button>
        </main>
      </body>
    </html>
  );
}
