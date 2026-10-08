import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const metadata = { title: "Вхід" };
export default async function Login() {
  if (await getAdmin()) redirect("/admin");
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-3xl text-moss-900">Вхід в адмінку</h1>
        <p className="mt-1 text-sm text-ink-soft">Історії принцеси Лілі</p>
        <LoginForm />
      </div>
    </main>
  );
}
