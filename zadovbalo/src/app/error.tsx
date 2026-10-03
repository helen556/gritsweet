"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/** Будь-яка помилка рендеру: без стектрейсів, з людським текстом. */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Лише digest — без повідомлення, яке може містити дані.
    console.error("render_error", error.digest ?? "no-digest");
  }, [error]);

  return (
    <main className="safe-px relative z-10 flex min-h-dvh flex-col items-center justify-center gap-8 bg-abyss text-center">
      <h1 className="font-display text-title font-medium text-frost">Щось зависло. Не ти — сайт.</h1>
      <Button size="lg" onClick={reset}>
        Спробувати ще раз
      </Button>
    </main>
  );
}
