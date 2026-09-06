"use client";
import { useActionState } from "react";
import { login } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="mt-5 grid gap-4">
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" required className="field" /></div>
      <div><label className="label" htmlFor="password">Пароль</label><input id="password" name="password" type="password" autoComplete="current-password" required className="field" /></div>
      {state && !state.ok && <p className="error" role="alert">{state.error}</p>}
      <button className="btn btn-cherry" disabled={pending}>{pending ? "Вхід…" : "Увійти"}</button>
    </form>
  );
}
