"use client";

import { useRouter } from "next/navigation";
import { SceneHost } from "@/components/scenes/SceneHost";
import type { SceneId } from "@/lib/scenes/registry";
import { CURRENCIES, type Currency } from "@/lib/topics";

export function DevScene({ id, amount, currency }: { id: SceneId; amount?: number; currency?: string }) {
  const router = useRouter();
  const cur = (CURRENCIES as readonly string[]).includes(currency ?? "") ? (currency as Currency) : null;
  return (
    <SceneHost
      id={id}
      input={{ amount: amount ?? 48500, currency: currency === undefined ? "UAH" : cur, labels: ["Робота", "Рахунки", "Чужі очікування"] }}
      topicNote="Службовий перегляд сцени."
      onExit={(kind) => (kind === "change" ? history.back() : router.push("/"))}
    />
  );
}
