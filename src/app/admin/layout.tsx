import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata = { title: "Адмінка — Grid Sweet Life", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const path = (await headers()).get("x-pathname") ?? "";
  // Сторінки входу/скидання не потребують сесії; решта перевіряється в кожній сторінці через requireAdmin()
  if (!session || path.startsWith("/admin/login") || path.startsWith("/admin/reset")) return <div className="min-h-dvh bg-milk text-ink">{children}</div>;
  return <AdminShell email={session.email}>{children}</AdminShell>;
}
