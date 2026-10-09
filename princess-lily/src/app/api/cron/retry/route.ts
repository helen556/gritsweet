import { retryDueNotifications } from "@/lib/telegram";
import { retryDueEmails } from "@/lib/fulfillment";

/**
 * Повтор Telegram-сповіщень і листів за розкладом (Vercel Cron або будь-який зовнішній cron).
 * Захищено секретом: заголовок Authorization: Bearer $CRON_SECRET (Vercel додає його автоматично).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const [n, e] = await Promise.all([retryDueNotifications(), retryDueEmails()]);
  return Response.json({ telegram: n.length, emails: e.length });
}
