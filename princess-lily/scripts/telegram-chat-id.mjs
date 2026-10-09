// Отримати chat_id через офіційний getUpdates після того, як власниця написала боту /start
// (для групи — після повідомлення в групі). Токен береться ЛИШЕ зі змінної середовища, не з аргументів.
//   TELEGRAM_BOT_TOKEN=… npm run telegram:chat-id
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) { console.error("Задайте TELEGRAM_BOT_TOKEN у середовищі (не вставляйте токен у чат чи файли репозиторію)."); process.exit(1); }
const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
const j = await r.json();
if (!j.ok) { console.error("Помилка Telegram:", j.description); process.exit(1); }
const chats = new Map();
for (const u of j.result ?? []) { const c = (u.message ?? u.channel_post ?? u.my_chat_member)?.chat; if (c) chats.set(c.id, `${c.type} — ${c.title ?? [c.first_name, c.last_name].filter(Boolean).join(" ")}`); }
if (!chats.size) console.log("Оновлень немає: напишіть боту /start (або повідомлення в групі) і запустіть ще раз.");
for (const [id, d] of chats) console.log(`TELEGRAM_CHAT_ID=${id}   (${d})`);
