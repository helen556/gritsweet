import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { emailConfig } from "../config";
import { newId } from "../ids";

export type EmailAttachment = { filename: string; content: Buffer; contentType: string };
export type EmailMessage = { to: string; subject: string; text: string; html: string; replyTo?: string; attachments?: EmailAttachment[] };
export type SendResult = { ok: true; id: string } | { ok: false; error: string; notConfigured?: boolean };

/** Email-адаптер (Resend, Gmail/SMTP). Без провайдера повертає явний стан «не налаштовано», нічого не імітує. */
export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const cfg = emailConfig();
  if (cfg.provider === "none") return { ok: false, error: "Email-провайдер не налаштовано", notConfigured: true };
  if (cfg.provider === "outbox") {
    // Лише розробка: лист і вкладення у файли, щоб перевірити вміст. Не в production.
    const id = newId("out");
    const dir = path.resolve("storage/outbox");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${id}.html`), `<!-- to: ${msg.to} | reply-to: ${msg.replyTo ?? ""} | ${msg.subject} | attachments: ${(msg.attachments ?? []).map((a) => `${a.filename} (${a.content.length} B)`).join(", ")} -->\n${msg.html}`);
    for (const a of msg.attachments ?? []) await fs.writeFile(path.join(dir, `${id}--${a.filename.replace(/[^\w.-]+/g, "_")}`), a.content);
    return { ok: true, id };
  }
  if (cfg.provider === "smtp") {
    try {
      const nodemailer = await import("nodemailer");
      const t = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.port === 465, auth: { user: cfg.user, pass: cfg.pass }, connectionTimeout: 15_000, socketTimeout: 60_000 });
      const info = await t.sendMail({
        from: cfg.from, to: msg.to, replyTo: msg.replyTo, subject: msg.subject, text: msg.text, html: msg.html,
        attachments: (msg.attachments ?? []).map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
      });
      return { ok: true, id: String(info.messageId ?? newId("smtp")) };
    } catch (e) {
      // текст помилки без пароля (nodemailer його не включає)
      return { ok: false, error: `SMTP: ${(e as Error).message}`.slice(0, 300) };
    }
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: cfg.from, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
        ...(msg.attachments?.length ? { attachments: msg.attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64"), content_type: a.contentType })) } : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const body = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!r.ok || !body.id) return { ok: false, error: `Resend ${r.status}: ${body.message ?? "помилка"}`.slice(0, 300) };
    return { ok: true, id: body.id };
  } catch (e) {
    return { ok: false, error: `Мережа: ${(e as Error).message}`.slice(0, 300) };
  }
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
