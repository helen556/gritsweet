import "../globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: { default: "Адмінка", template: "%s · Адмінка" }, robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#faf6ee" };
export const dynamic = "force-dynamic";

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body className="min-h-dvh bg-milk text-[1rem] antialiased">{children}</body>
    </html>
  );
}
