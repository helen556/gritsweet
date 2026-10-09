import Link from "next/link";
import { db } from "@/db";
import { formatMinor } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { paymentConfig, emailConfig, novaPoshtaKey } from "@/lib/config";
import { privateStorage } from "@/lib/storage";
import { telegramConfigured } from "@/lib/telegram";
import ActionForm from "@/components/admin/ActionForm";
import { retryNotificationsAction } from "../actions";
import { effectivePaymentMode, configuredPaymentMode } from "@/lib/orders";

export const metadata = { title: "Огляд" };

export default async function Dashboard({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const [toVerify, toShip, emailIssues, newMsgs, products, settings] = await Promise.all([
    db.selectFrom("orders").select(["id", "number", "total_minor", "created_at"]).where("payment_status", "=", "pending_verification").orderBy("created_at", "desc").limit(20).execute(),
    db.selectFrom("fulfillments as f").innerJoin("orders as o", "o.id", "f.order_id").select(["o.id", "o.number", "o.created_at"]).where("f.kind", "=", "shipping").where("f.status", "=", "to_ship").orderBy("o.created_at").limit(20).execute(),
    db.selectFrom("email_deliveries").select(["id", "order_id", "status", "last_error"]).where("status", "in", ["failed", "not_configured"]).limit(20).execute(),
    db.selectFrom("contact_messages").select(({ fn }) => fn.countAll<number>().as("n")).where("status", "=", "new").executeTakeFirst(),
    db.selectFrom("products").select(["id", "status"]).execute(),
    getSettings(),
  ]);
  const tgIssues = await db.selectFrom("notifications").selectAll().where("status", "!=", "sent").orderBy("created_at", "desc").limit(20).execute();
  const [modeNow, modeSet] = [await effectivePaymentMode(), await configuredPaymentMode()];
  const pc = paymentConfig();
  const checks: [string, boolean, string][] = [
    ["Режим оплати", modeNow !== "disabled", `обрано: ${modeSet}; діє: ${modeNow === "disabled" ? "вимкнено" : modeNow}${modeSet === "mono_acquiring" && !pc.monoToken ? " (немає MONOBANK_TOKEN)" : ""}`],
    ["Платіжне посилання", modeSet !== "manual_link" || !!settings.payment_link_url, settings.payment_link_url || "не задано"],
    ["Telegram-сповіщення", telegramConfigured(), telegramConfigured() ? "налаштовано (перевірте тестовим замовленням)" : "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID не задано"],
    ["Email-провайдер", emailConfig().provider !== "none", emailConfig().provider],
    ["Нова пошта API", !!novaPoshtaKey(), novaPoshtaKey() ? "підключено" : "ручне введення (працює без ключа)"],
    ["Приватне сховище PDF", true, privateStorage().kind],
    ["Контакти на сайті", !!(settings.contact_email || settings.contact_phone), settings.contact_email || "не заповнено"],
    ["Опубліковані товари", products.some((p) => p.status === "published"), `${products.filter((p) => p.status === "published").length} з ${products.length}`],
  ];
  return (
    <div className="space-y-8">
      {sp.denied && <p className="card border-rose p-4" role="alert">Цей розділ доступний лише власниці.</p>}
      <section className="card p-5"><h1 className="text-3xl text-moss-900">Стан магазину</h1>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">{checks.map(([l, ok, d]) => <li key={l} className="flex gap-2"><span aria-hidden="true">{ok ? "✅" : "⚠️"}</span><span><strong>{l}:</strong> {d}</span></li>)}</ul>
      </section>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="card p-5"><h2 className="text-2xl">Перевірити оплату ({toVerify.length})</h2>
          <ul className="mt-3 space-y-1">{toVerify.map((o) => <li key={o.id}><Link className="underline" href={`/admin/orders/${o.id}`}>{o.number}</Link> — {formatMinor(o.total_minor, "uk")}</li>)}{!toVerify.length && <li className="text-ink-soft">Немає</li>}</ul></section>
        <section className="card p-5"><h2 className="text-2xl">До відправлення ({toShip.length})</h2>
          <ul className="mt-3 space-y-1">{toShip.map((o) => <li key={o.id}><Link className="underline" href={`/admin/orders/${o.id}`}>{o.number}</Link></li>)}{!toShip.length && <li className="text-ink-soft">Немає</li>}</ul></section>
        <section className="card p-5"><h2 className="text-2xl">Проблеми з листами ({emailIssues.length})</h2>
          <ul className="mt-3 space-y-1">{emailIssues.map((e) => <li key={e.id}><Link className="underline" href={`/admin/orders/${e.order_id}`}>замовлення</Link> — {e.status}{e.last_error ? `: ${e.last_error}` : ""}</li>)}{!emailIssues.length && <li className="text-ink-soft">Немає</li>}</ul></section>
        <section className="card p-5"><h2 className="text-2xl">Telegram: не доставлено ({tgIssues.length})</h2>
          <ul className="mt-3 space-y-1 text-sm">{tgIssues.map((n) => <li key={n.id}>{n.order_id ? <Link className="underline" href={`/admin/orders/${n.order_id}`}>замовлення</Link> : "—"} — {n.status}{n.last_error ? `: ${n.last_error}` : ""}</li>)}{!tgIssues.length && <li className="text-ink-soft">Усе доставлено</li>}</ul>
          {tgIssues.length > 0 && <ActionForm action={retryNotificationsAction} submit="Повторити надсилання" className="mt-3" />}
        </section>
        <section className="card p-5"><h2 className="text-2xl">Нові звернення</h2><p className="mt-3"><Link className="underline" href="/admin/messages">{newMsgs?.n ?? 0} нових</Link></p></section>
      </div>
    </div>
  );
}
