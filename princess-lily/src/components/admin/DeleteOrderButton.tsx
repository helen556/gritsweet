"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteOrderAction } from "@/app/admin/actions";

/** «Видалити» з вікном «Ви впевнені?». Видалення виконує сервер (deleteOrderAction), не браузер. */
export default function DeleteOrderButton({ id, number, paid }: { id: string; number: string; paid: boolean }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const confirm = () => start(async () => {
    const fd = new FormData();
    fd.set("id", id); fd.set("confirm", "yes");
    const r: { ok?: string; error?: string } = await deleteOrderAction(fd).catch(() => ({ error: "Не вдалося видалити. Спробуйте ще раз." }));
    if (r.ok) { dlg.current?.close(); router.push(`/admin/orders?deleted=${encodeURIComponent(number)}`); }
    else setError(r.error ?? "Помилка");
  });
  return (
    <>
      <button type="button" className="btn btn-danger" onClick={() => { setError(null); dlg.current?.showModal(); }}>Видалити</button>
      <dialog ref={dlg} aria-labelledby="del-h" className="m-auto w-[min(92vw,30rem)] rounded-2xl bg-paper p-0 backdrop:bg-black/50">
        <div className="p-6">
          <h2 id="del-h" className="text-2xl text-plum-900">Ви впевнені?</h2>
          <p className="mt-3">Замовлення <strong>{number}</strong> буде видалено з бази назавжди разом з історією, квитанціями й посиланнями. Відновити його буде неможливо.</p>
          {paid && <p className="mt-3 rounded-xl bg-rose-100 p-3 text-sm">⚠️ Замовлення оплачене. Повернення коштів, якщо потрібне, робиться окремо в платіжному сервісі. Друковані книжки, які ще не відправлено, повернуться на склад.</p>}
          <p className="mt-3 text-sm text-ink-soft">Якщо замовлення справжнє, але його треба зупинити, краще «Скасувати» — тоді воно лишиться в історії.</p>
          {error && <p className="err mt-3" role="alert">{error}</p>}
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button type="button" className="btn btn-ghost" onClick={() => dlg.current?.close()} autoFocus disabled={pending}>Ні, залишити</button>
            <button type="button" className="btn btn-danger" onClick={confirm} disabled={pending} aria-busy={pending}>{pending ? "Видаляємо…" : "Так, видалити"}</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
