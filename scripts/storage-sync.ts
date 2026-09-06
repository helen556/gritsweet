import "dotenv/config";
// Одноразово: заливає оригінали стартових відгуків (storage/private/reviews) у приватний бакет Supabase,
// щоб чернетки можна було опублікувати з адмінки на Vercel. Запуск локально: npm run storage:sync
import fs from "node:fs";
import path from "node:path";
import { putPrivate, usingSupabase, ensureBuckets } from "../src/lib/storage";

(async () => {
  if (!usingSupabase) { console.log("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY не задані — нічого робити."); return; }
  await ensureBuckets();
  const dir = path.resolve("storage/private/reviews");
  let n = 0;
  for (const f of fs.readdirSync(dir)) { if (!f.endsWith(".webp")) continue; await putPrivate(`reviews/${f}`, fs.readFileSync(path.join(dir, f))); n++; }
  console.log(`Завантажено ${n} файлів у приватний бакет.`);
})();
