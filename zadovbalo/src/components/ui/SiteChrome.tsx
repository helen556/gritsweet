import Link from "next/link";
import { cn } from "@/lib/cn";

/** Мінімальна рамка: словесний знак угорі, дрібні посилання внизу. Не конкурує з великими словами. */
export function SiteHeader({ className }: { className?: string }) {
  return (
    <header className={cn("safe-px safe-pt pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between", className)}>
      <Link
        href="/"
        className="pointer-events-auto font-display text-lg italic tracking-tight text-frost/85 transition-colors hover:text-frost min-h-11 inline-flex items-center"
      >
        Задовбало
      </Link>
      <Link
        href="/about"
        className="pointer-events-auto inline-flex min-h-11 items-center text-[0.8rem] uppercase tracking-[0.18em] text-mist/80 transition-colors hover:text-frost"
      >
        Що це
      </Link>
    </header>
  );
}

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "safe-px safe-pb flex flex-wrap items-center justify-between gap-x-6 text-[0.75rem] text-mist/70",
        className,
      )}
    >
      <p>Не терапія і не заміна допомоги.</p>
      <Link href="/privacy" className="inline-flex min-h-11 items-center underline-offset-4 hover:text-frost hover:underline">
        Приватність
      </Link>
    </footer>
  );
}
