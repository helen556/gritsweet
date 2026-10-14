"use client";
import "./globals.css";
import { useEffect } from "react";

let autoRetried = false;

/**
 * Помилка поза межами сторінок (у спільному макеті). Замість чорного екрана Next.js —
 * сторінка в стилі сайту; разовий тихий повтор рятує від короткочасних збоїв з'єднання.
 */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    if (autoRetried) return;
    autoRetried = true;
    const t = setTimeout(() => retry(), 1200);
    return () => clearTimeout(t);
  }, [retry]);
  const en = typeof navigator !== "undefined" && /^\/en(\/|$)/.test(location.pathname);
  return (
    <html lang={en ? "en" : "uk"}>
      <body className="min-h-dvh bg-milk antialiased">
        <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6" role="alert">
          <h1 className="text-4xl text-plum-900 sm:text-5xl">{en ? "Something went wrong" : "Щось пішло не так"}</h1>
          <p className="mt-4 text-lg text-ink-soft">
            {en ? "Please try again in a moment." : "Спробуйте ще раз за мить — зазвичай це допомагає."}
          </p>
          <button type="button" onClick={() => location.reload()} className="btn btn-primary mt-8">
            {en ? "Try again" : "Спробувати ще раз"}
          </button>
        </div>
      </body>
    </html>
  );
}
