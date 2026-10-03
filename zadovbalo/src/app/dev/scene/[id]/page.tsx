import { notFound } from "next/navigation";
import { isSceneId } from "@/lib/scenes/registry";
import { DevScene } from "./DevScene";

export const metadata = { robots: { index: false, follow: false } };

/** Службовий перегляд однієї сцени для розробки. У продакшені — 404. */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_SCENES !== "true") notFound();
  const { id } = await params;
  if (!isSceneId(id)) notFound();
  const q = await searchParams;
  return <DevScene id={id} amount={q.amount ? Number(q.amount) : undefined} currency={q.currency} />;
}
