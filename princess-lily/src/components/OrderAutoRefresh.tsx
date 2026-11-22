"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Сторінка замовлення, поки оплата ще не підтверджена: сама перевіряє статус (перезавантажує дані з сервера),
 * щоб після повернення з monobank покупець без натискань побачив «Дякуємо за покупку!» (і спрацювала подія Purchase).
 * Перші 3 хвилини — кожні 3 с, далі до 20 хв — кожні 15 с; у фоновій вкладці не перевіряє.
 */
export default function OrderAutoRefresh({ text }: { text: string }) {
  const router = useRouter();
  const [active, setActive] = useState(true);
  useEffect(() => {
    const start = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const age = Date.now() - start;
      if (age > 20 * 60_000) { setActive(false); return; }
      if (document.visibilityState === "visible") router.refresh();
      timer = setTimeout(tick, age < 3 * 60_000 ? 3000 : 15000);
    };
    timer = setTimeout(tick, 2000);
    const onVisible = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [router]);
  if (!active) return null;
  return (
    <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft" aria-live="polite">
      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-plum-700/25 border-t-plum-700 motion-reduce:animate-none" aria-hidden="true" />
      {text}
    </p>
  );
}
