"use server";
import { redirect } from "next/navigation";
import { createSession, destroySession, verifyPassword, getAdmin } from "@/lib/auth";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { sha256 } from "@/lib/ids";

export async function loginAction(_: { error: string }, fd: FormData) {
  const email = String(fd.get("email") ?? "").toLowerCase().trim().slice(0, 200);
  const password = String(fd.get("password") ?? "").slice(0, 200);
  // ліміт і за IP, і за обліковим записом
  if (!(await rateLimit("login", 10, 900)) || !(await rateLimitKey(`login-acct:${sha256(email).slice(0, 24)}`, 8, 900)))
    return { error: "Забагато спроб. Спробуйте через 15 хвилин." };
  const u = await verifyPassword(email, password);
  if (!u) return { error: "Невірний email або пароль." };
  await createSession(u);
  await audit({ id: u.id, email: u.email }, "login");
  redirect("/admin");
}
export async function logoutAction() {
  const a = await getAdmin();
  if (a) await audit(a, "logout");
  await destroySession();
  redirect("/admin/login");
}
