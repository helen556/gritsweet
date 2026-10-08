import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { emailConfig } from "../config";
import { newId } from "../ids";

export type EmailMessage = { to: string; subject: string; text: string; html: string };
export type SendResult = { ok: true; id: string } | { ok: false; error: string; notConfigured?: boolean };

/** Email-адаптер. Без провайдера повертає явний стан «не налаштовано», нічого не імітує. */
export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const cfg = emailConfig();
  if (cfg.provider === "none") return { ok: false, error: "Email-провайдер не налаштовано", notConfigured: true };
  if (cfg.provider === "outbox") {
    // Лише розробка: лист у файл, щоб перевірити вміст. Не в production.
    const id = newId("out");
    const dir = path.resolve("storage/outbox");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${id}.html`), `<!-- to: ${msg.to} | ${msg.subject} -->\n${msg.html}`);
    return { ok: true, id };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: cfg.from, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!r.ok || !body.id) return { ok: false, error: `Resend ${r.status}: ${body.message ?? "помилка"}`.slice(0, 300) };
    return { ok: true, id: body.id };
  } catch (e) {
    return { ok: false, error: `Мережа: ${(e as Error).message}`.slice(0, 300) };
  }
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
