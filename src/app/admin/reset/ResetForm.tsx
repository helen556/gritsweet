"use client";
import { useActionState } from "react";
import { resetPassword } from "../actions";
export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, null);
  if (state?.ok) return <p className="mt-4">{state.message} <a className="underline" href="/admin/login">Увійти</a></p>;
  return (
    <form action={action} className="mt-5 grid gap-4">
      <input type="hidden" name="token" value={token} />
      <div><label className="label" htmlFor="password">Новий пароль (≥ 10 символів)</label><input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className="field" /></div>
      {state && !state.ok && <p className="error" role="alert">{state.error}</p>}
      <button className="btn btn-cherry" disabled={pending}>Зберегти пароль</button>
    </form>
  );
}
