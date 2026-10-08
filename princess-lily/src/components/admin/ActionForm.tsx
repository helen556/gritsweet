"use client";
import { startTransition, useActionState } from "react";
import type { ActionState } from "@/app/admin/actions";

/** Форма адмінки з відображенням результату (aria-live) і станом очікування. */
export default function ActionForm({
  action, children, submit, className = "", danger = false,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  children?: React.ReactNode; submit: string; className?: string; danger?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      // без автоматичного скидання полів після дії (щоб при помилці введене не зникало)
      onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => formAction(fd)); }}
      className={className}
    >
      {children}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} disabled={pending} aria-busy={pending}>{pending ? "Зачекайте…" : submit}</button>
        <div aria-live="polite" className="text-sm">
          {state.ok && <p className="font-semibold text-moss-700">✓ {state.ok}</p>}
          {state.error && <p className="err" role="alert">{state.error}</p>}
        </div>
      </div>
      {state.links && (
        <ul className="mt-3 space-y-2 rounded-xl bg-cream p-3 text-sm">
          {state.links.map((l) => <li key={l.url}><span className="font-semibold">{l.title}:</span> <input readOnly value={l.url} className="input mt-1 !min-h-10 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} /></li>)}
        </ul>
      )}
    </form>
  );
}
