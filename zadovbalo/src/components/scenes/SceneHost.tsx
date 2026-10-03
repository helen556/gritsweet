"use client";

import dynamic from "next/dynamic";
import { SCENES, type SceneId } from "@/lib/scenes/registry";
import { SceneShell } from "./SceneShell";
import type { SceneInput, SceneProps } from "./types";

function Loading() {
  return (
    <div className="grid h-full place-items-center" role="status">
      <span className="text-sm text-mist">Готую сцену…</span>
    </div>
  );
}

/** Кожна сцена — окремий чанк; важкі ефекти не потрапляють у перший екран. */
const SCENE_COMPONENTS: Record<SceneId, React.ComponentType<SceneProps>> = {
  debt: dynamic(() => import("./debt/DebtScene"), { ssr: false, loading: Loading }),
  clay: dynamic(() => import("./clay/ClayScene"), { ssr: false, loading: Loading }),
  stickers: dynamic(() => import("./stickers/StickersScene"), { ssr: false, loading: Loading }),
  paper: dynamic(() => import("./paper/PaperScene"), { ssr: false, loading: Loading }),
  ice: dynamic(() => import("./ice/IceScene"), { ssr: false, loading: Loading }),
  backpack: dynamic(() => import("./backpack/BackpackScene"), { ssr: false, loading: Loading }),
  yarn: dynamic(() => import("./yarn/YarnScene"), { ssr: false, loading: Loading }),
  sand: dynamic(() => import("./sand/SandScene"), { ssr: false, loading: Loading }),
  war_map: dynamic(() => import("./war/WarMapScene"), { ssr: false, loading: Loading }),
};

/** Перша підказка й чи потрібен перемикач інтенсивності. */
const SCENE_UI: Record<SceneId, { hint: string; intensity?: boolean }> = {
  debt: { hint: "Візьми купюру пальцем і перенеси на суму." },
  clay: { hint: "Натисни на глину — і тримай. Потягни, щоб розтягнути.", intensity: true },
  stickers: { hint: "Підчепи наліпку за кут і повільно тягни." },
  paper: { hint: "Проведи пальцем через аркуш, щоб розірвати. Затисни — щоб змʼяти.", intensity: true },
  ice: { hint: "Торкнися льоду — тріщина піде від пальця.", intensity: true },
  backpack: { hint: "Потягни за бігунок блискавки." },
  yarn: { hint: "Знайди світлий кінчик нитки й повільно тягни." },
  sand: { hint: "Веди пальцем по піску. Камінці можна пересувати." },
  war_map: { hint: "Обери дію внизу." },
};

export function SceneHost({
  id,
  input,
  onChangeAction,
  onFinish,
}: {
  id: SceneId;
  input: SceneInput;
  onChangeAction: () => void;
  onFinish: () => void;
}) {
  const ui = SCENE_UI[id];
  return (
    <SceneShell
      meta={SCENES[id]}
      Scene={SCENE_COMPONENTS[id]}
      input={input}
      firstHint={ui.hint}
      withIntensity={ui.intensity}
      onChangeAction={onChangeAction}
      onFinish={onFinish}
    />
  );
}
