"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type T = { title: string; hint: string; upload: string; ok: string; err: string; errSize: string; errType: string; busy: string };

/** Великі фото квитанцій (скриншоти з телефона) стискаються в браузері до JPEG ≤ ~2000 px — так файл гарантовано проходить ліміт сервера. */
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 1.2 * 1024 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.86));
    return blob ? new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}

/**
 * Обов'язкова квитанція при ручній оплаті за посиланням: покупець додає скриншот/PDF — і лише разом із файлом
 * замовлення переходить у «перевірку оплати». Файл приватний (бачить лише адміністратор). Оплаченим замовлення
 * стає тільки після підтвердження власницею в адмінці.
 */
export default function ReceiptUpload({ token, t, done }: { token: string; t: T; done: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "busy" | "ok" | "err">(done ? "ok" : "idle");
  const [msg, setMsg] = useState("");
  return (
    <form className="mt-6 overflow-hidden rounded-2xl border border-black/10 p-4 sm:p-5" onSubmit={async (e) => {
      e.preventDefault();
      const f = input.current?.files?.[0];
      if (!f) return;
      setState("busy");
      const file = await shrink(f);
      if (file.size > 4 * 1024 * 1024) { setState("err"); setMsg(t.errSize); return; }
      const fd = new FormData();
      fd.set("token", token);
      fd.set("file", file);
      const r = await fetch("/api/receipts", { method: "POST", body: fd }).catch(() => null);
      if (r?.ok) { setState("ok"); setMsg(""); if (input.current) input.current.value = ""; router.refresh(); return; }
      const code = r ? ((await r.json().catch(() => ({}))) as { error?: string }).error : "";
      setState("err");
      setMsg(code === "size" || r?.status === 413 ? t.errSize : code === "type" ? t.errType : t.err);
    }}>
      <p className="font-semibold">{t.title}</p>
      <p className="mt-1 text-sm text-ink-soft">{t.hint}</p>
      <input ref={input} type="file" name="file" required accept="image/jpeg,image/png,image/webp,application/pdf" aria-label={t.title}
        className="mt-3 block w-full min-w-0 max-w-full text-sm text-ink-soft file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-full file:border-0 file:bg-moss-100 file:px-4 file:py-2 file:font-semibold file:text-moss-900" />
      <button className="btn btn-primary btn-sm mt-4" disabled={state === "busy"}>{state === "busy" ? t.busy : t.upload}</button>
      <p aria-live="polite" className="mt-3 text-sm">{state === "ok" ? <span className="text-moss-700">✓ {t.ok}</span> : state === "err" ? <span className="err">{msg}</span> : null}</p>
    </form>
  );
}
