import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "404 — Історії принцеси Лілі", robots: { index: false } };

export default function GlobalNotFound() {
  return (
    <html lang="uk">
      <body className="grid min-h-dvh place-items-center bg-milk px-4 text-center">
        <main>
          <p className="font-display text-7xl text-gold">404</p>
          <h1 className="mt-4 text-4xl text-moss-900">Сторінку не знайдено · Page not found</h1>
          <p className="mt-8 flex justify-center gap-3"><Link className="btn btn-primary" href="/uk">На головну</Link><Link className="btn btn-ghost" href="/en">Home</Link></p>
        </main>
      </body>
    </html>
  );
}
