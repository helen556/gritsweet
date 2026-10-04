"use client";

import { useRouter } from "next/navigation";
import { SceneHost } from "@/components/scenes/SceneHost";
import type { SceneId } from "@/lib/scenes/registry";

export function DevScene({ id, amount }: { id: SceneId; amount?: number }) {
  const router = useRouter();
  return (
    <SceneHost
      id={id}
      input={{ amount: amount ?? 48500, currency: "UAH", labels: ["Робота", "Рахунки", "Чужі очікування"] }}
      topicNote="Службовий перегляд сцени."
      onExit={(kind) => (kind === "change" ? history.back() : router.push("/"))}
      onSwitch={(next) => router.push(`/dev/scene/${next}`)}
    />
  );
}
