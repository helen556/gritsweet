import Link from "next/link";
import { StormHero } from "@/components/hero/StormHero";

export default function NotFound() {
  return (
    <>
      <StormHero scene="storm" still />
      <main className="safe-px relative z-10 flex min-h-dvh flex-col items-center justify-center gap-8 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-mist">404</p>
        <h1 className="font-display text-giant font-medium text-frost">Тут нічого немає.</h1>
        <p className="text-lede text-frost/80">Навіть того, що бісить.</p>
        <Link
          href="/"
          className="inline-flex min-h-14 items-center rounded-[var(--radius-hair)] bg-frost px-8 font-medium text-abyss transition-colors hover:bg-white"
        >
          На головну
        </Link>
      </main>
    </>
  );
}
