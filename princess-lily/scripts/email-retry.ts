import "dotenv/config";
import { db } from "../src/db";
import { retryDueEmails } from "../src/lib/fulfillment";

/** Повторні спроби листів (запускати cron-ом, напр. кожні 10 хв). */
retryDueEmails().then(async (r) => { console.log(`Оброблено листів: ${r.length}`); await db.destroy(); });
