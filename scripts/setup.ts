import "dotenv/config";
import { db } from "../src/db";
import { migrate } from "../src/db/migrate";
import { seed } from "../src/db/seed";
import { ensureBuckets, usingSupabase } from "../src/lib/storage";

(async () => {
  await migrate(db);
  await ensureBuckets();
  if (usingSupabase) console.log("Supabase Storage: бакети готові.");
  await seed(db);
  console.log("База готова.");
  await db.destroy();
})().catch((e) => { console.error(e); process.exit(1); });
