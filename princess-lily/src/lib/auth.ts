import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "@/db";

const COOKIE = "pl_admin";
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET має бути щонайменше 32 символи");
  return new TextEncoder().encode(s);
};

export type Role = "owner" | "staff";
export type AdminSession = { id: string; email: string; role: Role };

export async function createSession(user: { id: string; email: string; session_version: number }) {
  const token = await new SignJWT({ v: user.session_version })
    .setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuedAt().setExpirationTime("12h").sign(secret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
}
export async function destroySession() { (await cookies()).delete(COOKIE); }

/** Сесія перевіряється на сервері по БД: неактивний користувач або змінена версія сесії → немає доступу. */
export async function getAdmin(): Promise<AdminSession | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    const u = await db.selectFrom("admin_users").select(["id", "email", "role", "is_active", "session_version"]).where("id", "=", payload.sub).executeTakeFirst();
    if (!u || !u.is_active || u.session_version !== payload.v) return null;
    return { id: u.id, email: u.email, role: u.role };
  } catch { return null; }
}

/** Викликати на початку КОЖНОЇ адмін-сторінки, server action та адмін-API. */
export async function requireAdmin(role: Role = "staff"): Promise<AdminSession> {
  const s = await getAdmin();
  if (!s) redirect("/admin/login");
  if (role === "owner" && s.role !== "owner") redirect("/admin?denied=1");
  return s;
}

const DUMMY = "$2b$12$09Ypih9YYQVNUto.IyzqbOsSCAr6hoThk7vUYlTWsBYLDO5.Rad3G";
export async function verifyPassword(email: string, password: string) {
  const u = await db.selectFrom("admin_users").selectAll().where("email", "=", email.toLowerCase().trim()).executeTakeFirst();
  const ok = await bcrypt.compare(password, u?.password_hash ?? DUMMY); // сталий час
  return ok && u && u.is_active ? u : null;
}
export const hashPassword = (p: string) => bcrypt.hash(p, 12);
/** Мінімальні вимоги до пароля; заборонені очевидні значення на кшталт admin/admin. */
export function passwordProblem(p: string, email = ""): string | null {
  if (p.length < 12) return "Пароль має містити щонайменше 12 символів";
  const low = p.toLowerCase();
  if (["admin", "password", "123456", "qwerty"].some((w) => low.includes(w)) || (email && low.includes(email.split("@")[0].toLowerCase()))) return "Пароль занадто простий";
  return null;
}
