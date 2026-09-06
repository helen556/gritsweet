import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grid Sweet Life — авторські торти та зефірні квіти у Кропивницькому",
  description: "Кондитерка Дар’я. Торти, бенто, капкейки, зефір і зефірні квіти на замовлення у Кропивницькому.",
};
export const viewport: Viewport = { themeColor: "#1b100c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
