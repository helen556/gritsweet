import "dotenv/config";
import { db } from "../src/db";
import { retryDueNotifications } from "../src/lib/telegram";
import { retryDueEmails } from "../src/lib/fulfillment";

/** Повтор Telegram-сповіщень і листів, у яких настав час наступної спроби (cron кожні 5–10 хв). */
Promise.all([retryDueNotifications(), retryDueEmails()]).then(async ([n, e]) => { console.log(`Telegram: ${n.length}, листи: ${e.length}`); await db.destroy(); });
