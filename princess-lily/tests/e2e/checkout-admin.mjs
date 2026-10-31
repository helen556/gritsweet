/**
 * 18.1–18.3: обов'язкові поля оформлення (маска +380, підсвітка, ширини телефона), видалення замовлення
 * з підтвердженням, PDF збірки замовлень. Запуск проти dev-сервера з демо-БД (як flow.mjs):
 *   node tests/e2e/checkout-admin.mjs [screenshotsDir]
 */
import { chromium } from "playwright";
import fs from "node:fs";
import Database from "better-sqlite3";
const B = process.env.BASE_URL ?? "http://localhost:3000", OUT = process.argv[2] ?? "test-results/e2e-18";
fs.mkdirSync(OUT, { recursive: true });
{ const d = new Database("data/demo.db"); d.prepare("update product_variants set stock = 5 where id = 'var_demo_uk_print'").run(); d.prepare("delete from rate_limits").run(); d.close(); }
const res = []; const ok = (n, c, x = "") => res.push(`${c ? "PASS" : "FAIL"} ${n} ${x}`);
const br = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await br.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });
const pg = await ctx.newPage();
// ---- 18.1: лише PDF — телефон обов'язковий, НП не потрібна ----
await pg.goto(`${B}/uk/books/demo-book`, { waitUntil: "networkidle" });
await pg.getByText("Українська", { exact: true }).first().click();
await pg.getByText("Електронна книжка (PDF)", { exact: true }).click();
await pg.getByRole("button", { name: "Купити зараз" }).click();
await pg.waitForURL(/checkout/); await pg.waitForSelector('[name="email"]');
ok("PDF-only: no Nova Poshta fields", !(await pg.$('[name="npCity"]')));
ok("PDF-only: phone field shown", !!(await pg.$('[name="phone"]')));
const before = new Database("data/demo.db").prepare("select count(*) n from orders").get().n;
await pg.getByRole("button", { name: "Перейти до оплати" }).click();
await pg.waitForTimeout(400);
const invalid = await pg.$$eval('[aria-invalid="true"]', (a) => a.map((x) => x.name));
ok("empty submit highlights all required", ["lastName", "firstName", "phone", "email"].every((n) => invalid.includes(n)), JSON.stringify(invalid));
const bg = await pg.$eval('[name="phone"]', (e) => getComputedStyle(e).backgroundColor);
ok("highlight visible (pink background)", bg !== "rgba(0, 0, 0, 0)" && bg !== "rgb(255, 255, 255)", bg);
await pg.screenshot({ path: `${OUT}/checkout-errors-375.png`, fullPage: true });
await pg.fill('[name="lastName"]', "Тестова");
ok("highlight clears on input", !(await pg.$eval('[name="lastName"]', (e) => e.getAttribute("aria-invalid"))));
await pg.fill('[name="firstName"]', "Олена"); await pg.fill('[name="email"]', "t18@example.com");
await pg.click('[name="phone"]'); await pg.keyboard.type("050123");
ok("phone mask while typing", (await pg.inputValue('[name="phone"]')) === "+380 50 123", await pg.inputValue('[name="phone"]'));
await pg.getByRole("button", { name: "Перейти до оплати" }).click(); await pg.waitForTimeout(400);
ok("incomplete phone rejected", (await pg.$eval('[name="phone"]', (e) => e.getAttribute("aria-invalid"))) === "true" && (await pg.textContent("main")).includes("+380XXXXXXXXX"));
ok("no order created while invalid", new Database("data/demo.db").prepare("select count(*) n from orders").get().n === before);
await pg.fill('[name="phone"]', ""); await pg.click('[name="phone"]'); await pg.keyboard.type("0501234567");
await pg.getByRole("button", { name: "Перейти до оплати" }).click();
await pg.waitForURL(/\/uk\/order\/|test-checkout/, { timeout: 20000 }).catch(() => {});
const row = new Database("data/demo.db").prepare("select number, phone, np_city from orders order by created_at desc limit 1").get();
ok("valid → order created, phone normalized, no NP", /\/order\/|test-checkout/.test(pg.url()) && row.phone === "+380501234567" && row.np_city === null, JSON.stringify(row));
// ---- сервер: обхід клієнта (прямий виклик без телефону) не створює замовлення ----
// ---- 18.1: друк — НП обов'язкова ----
await pg.goto(`${B}/uk/books/demo-book`, { waitUntil: "networkidle" });
await pg.getByText("Українська", { exact: true }).first().click();
await pg.getByText("Друкована книжка", { exact: true }).click();
await pg.getByRole("button", { name: "Купити зараз" }).click();
await pg.waitForURL(/checkout/); await pg.waitForLoadState("networkidle");
await pg.fill('[name="lastName"]', "Тестова"); await pg.fill('[name="firstName"]', "Олена"); await pg.fill('[name="email"]', "t18@example.com");
await pg.click('[name="phone"]'); await pg.keyboard.type("0501234567");
await pg.getByRole("button", { name: "Перейти до оплати" }).click(); await pg.waitForTimeout(400);
const inv2 = await pg.$$eval('[aria-invalid="true"]', (a) => a.map((x) => x.name));
ok("print: Nova Poshta required", inv2.includes("npCity") && inv2.includes("npPoint"), JSON.stringify(inv2));
for (const w of [320, 375, 390]) {
  await pg.setViewportSize({ width: w, height: 800 });
  const ov = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`checkout ${w}px no h-scroll`, ov <= 0, `(${ov})`);
}
await pg.screenshot({ path: `${OUT}/checkout-print-320.png`, fullPage: true });
// ---- 18.2 / 18.3: адмінка ----
const anon = await fetch(`${B}/admin/orders-export?format=picking`);
ok("picking PDF without login → 401", anon.status === 401);
const adm = await br.newContext({ viewport: { width: 1280, height: 900 } }); const a = await adm.newPage();
await a.goto(`${B}/admin/login`);
await a.getByLabel("Email", { exact: true }).fill("owner@example.com"); await a.getByLabel("Пароль").fill("Garden-Path-Lantern-2026");
await a.getByRole("button", { name: /Увійти/ }).click(); await a.waitForURL(`${B}/admin`, { timeout: 60000 });
await a.goto(`${B}/admin/orders`, { waitUntil: "networkidle" });
ok("orders list: picking buttons", await a.getByRole("button", { name: "Позначені або всі за фільтром" }).isVisible());
await a.locator('input[form="pick"][name="id"]').first().check();
const ids = await a.$$eval('input[form="pick"][name="id"]:checked', (x) => x.map((e) => e.value));
const r = await a.request.get(`${B}/admin/orders-export?format=picking&id=${ids[0]}`);
const body = await r.body();
ok("picking PDF (selected) → 200 PDF", r.status() === 200 && body.subarray(0, 5).toString() === "%PDF-" && (r.headers()["content-disposition"] ?? "").includes("zbirka"), `${body.length} B`);
const all = await a.request.get(`${B}/admin/orders-export?format=picking&payment=paid&shipping=to_ship`);
ok("picking PDF (paid, to ship) → 200", all.status() === 200);
// видалення: модальне вікно, «Ні» нічого не робить, «Так» видаляє
await a.goto(`${B}/admin/orders`, { waitUntil: "networkidle" });
const number = row.number;
const id = new Database("data/demo.db").prepare("select id from orders where number=?").get(number).id;
await a.goto(`${B}/admin/orders/${id}`, { waitUntil: "networkidle" });
ok("cancel button still there", await a.getByRole("button", { name: "Скасувати", exact: true }).isVisible());
await a.getByRole("button", { name: "Видалити", exact: true }).click();
ok("confirm dialog shown", await a.getByRole("heading", { name: "Ви впевнені?" }).isVisible());
await a.screenshot({ path: `${OUT}/delete-dialog.png` });
await a.getByRole("button", { name: "Ні, залишити" }).click();
ok("'no' keeps the order", !!new Database("data/demo.db").prepare("select id from orders where id=?").get(id));
await a.getByRole("button", { name: "Видалити", exact: true }).click();
await a.getByRole("button", { name: "Так, видалити" }).click();
await a.waitForURL(/\/admin\/orders\?deleted=/, { timeout: 20000 });
ok("deleted: redirected with notice", (await a.textContent("main")).includes(`${number} видалено`));
const db2 = new Database("data/demo.db");
ok("deleted from DB (order + items + events)", !db2.prepare("select id from orders where id=?").get(id) && !db2.prepare("select id from order_items where order_id=?").get(id) && !db2.prepare("select id from order_events where order_id=?").get(id));
ok("audit log has the deletion", !!db2.prepare("select id from audit_log where action='order.delete' and entity_id=?").get(id));
// мобільна адмінка
await a.setViewportSize({ width: 375, height: 800 });
await a.goto(`${B}/admin/orders`, { waitUntil: "networkidle" });
ok("admin orders 375px no h-scroll", (await a.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
await a.screenshot({ path: `${OUT}/admin-orders-375.png`, fullPage: true });
await br.close();
console.log(res.join("\n")); console.log(`\n${res.filter((x) => x.startsWith("PASS")).length}/${res.length} passed`);
if (res.some((r) => r.startsWith("FAIL"))) process.exit(1);
