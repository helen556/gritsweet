import { ResetForm } from "./ResetForm";
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-3xl">Новий пароль</h1>
        {token ? <ResetForm token={token} /> : <p className="mt-3 text-sm text-cherry">Немає токена. Відкрийте посилання, створене на сервері.</p>}
      </div>
    </main>
  );
}
