"use client";
import { startTransition, useActionState } from "react";
import { loginAction } from "../auth-actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, { error: "" });
  return (
    <form action={action} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }} className="mt-6 space-y-4">
      <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" required className="input" /></div>
      <div className="field"><label htmlFor="password">Пароль</label><input id="password" name="password" type="password" autoComplete="current-password" required className="input" /></div>
      <div aria-live="assertive">{state.error && <p className="err" role="alert">{state.error}</p>}</div>
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Перевіряємо…" : "Увійти"}</button>
    </form>
  );
}
