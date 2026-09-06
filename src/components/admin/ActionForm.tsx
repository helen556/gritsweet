"use client";
import { useActionState } from "react";
import type { ActionResult } from "@/app/admin/actions";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

/** Форма з серверною дією: показує результат збереження або помилку; небезпечні дії — з підтвердженням. */
export function ActionForm({ action, children, className = "", confirm, submitLabel, submitClass = "btn btn-cherry", inline = false, hiddens = {} }:
  { action: Action; children?: React.ReactNode; className?: string; confirm?: string; submitLabel: string; submitClass?: string; inline?: boolean; hiddens?: Record<string, string> }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className} onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
      {Object.entries(hiddens).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      <div className={inline ? "inline-flex items-center gap-2" : "mt-4 flex flex-wrap items-center gap-3"}>
        <button type="submit" className={submitClass} disabled={pending} aria-busy={pending}>{pending ? "Зачекайте…" : submitLabel}</button>
        {state && <span role="status" className={`text-sm ${state.ok ? "text-green-800" : "text-cherry"}`}>{state.ok ? state.message ?? "Готово" : state.error}</span>}
      </div>
    </form>
  );
}
