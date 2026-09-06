import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/db";
import { redirect } from "next/navigation";

const COOKIE = "gsl_admin";
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET має бути щонайменше 32 символи");
  return new TextEncoder().encode(s);
};

export type Session = { sub: string; email: string };

export async function createSession(user: { id: string; email: string }) {
  const token = await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12,
  });
}
export async function destroySession() {
  (await cookies()).delete(COOKIE);
}
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    const user = await db.selectFrom("admin_users").select(["id", "email"]).where("id", "=", payload.sub).executeTakeFirst();
    return user ? { sub: user.id, email: user.email } : null;
  } catch { return null; }
}
/** Викликати на початку кожної адмін-сторінки та server action. */
export async function requireAdmin(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  return s;
}
export async function verifyPassword(email: string, password: string) {
  const user = await db.selectFrom("admin_users").selectAll().where("email", "=", email.toLowerCase().trim()).executeTakeFirst();
  // сталий час відповіді незалежно від існування користувача
  const hash = user?.password_hash ?? "$2a$12$CwTycUXWue0Thq9StjUM0uJ8Jm5oS1XsK4zYgQ2Y8i6mS6QG1sJ1i";
  const ok = await bcrypt.compare(password, hash);
  return ok && user ? { id: user.id, email: user.email } : null;
}
export async function setPassword(userId: string, password: string) {
  await db.updateTable("admin_users").set({ password_hash: await bcrypt.hash(password, 12), reset_token_hash: null, reset_token_expiry: null }).where("id", "=", userId).execute();
}
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export async function createResetToken(email: string): Promise<string | null> {
  const user = await db.selectFrom("admin_users").select("id").where("email", "=", email.toLowerCase()).executeTakeFirst();
  if (!user) return null;
  const token = randomBytes(32).toString("base64url");
  await db.updateTable("admin_users").set({ reset_token_hash: hashToken(token), reset_token_expiry: new Date(Date.now() + 30 * 60_000).toISOString() }).where("id", "=", user.id).execute();
  return token;
}
export async function consumeResetToken(token: string) {
  const user = await db.selectFrom("admin_users").select(["id", "reset_token_expiry"]).where("reset_token_hash", "=", hashToken(token)).executeTakeFirst();
  if (!user || !user.reset_token_expiry || new Date(user.reset_token_expiry) < new Date()) return null;
  return user.id;
}
