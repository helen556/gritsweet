import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getSession()) redirect("/admin");
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-3xl">Вхід для Дар’ї</h1>
        <p className="mt-1 text-sm text-muted">Розділ адміністратора</p>
        <LoginForm />
        <p className="mt-6 text-xs text-muted">Забули пароль? Посилання для відновлення створюється командою на сервері: <code>npm run admin:reset -- ваш@email</code>. Email-розсилка не підключена.</p>
      </div>
    </main>
  );
}
