"use client";

import dynamic from "next/dynamic";
import { SCENES, type SceneId } from "@/lib/scenes/registry";
import { SceneShell, type SceneExit } from "./SceneShell";
import type { SceneInput, SceneProps } from "./types";

function Loading() {
  return (
    <div className="grid h-full place-items-center" role="status">
      <span className="text-sm text-mist">Готую сцену…</span>
    </div>
  );
}

/** Кожна сцена — окремий чанк; важкі ефекти й матеріали не потрапляють у перший екран. */
const SCENE_COMPONENTS: Record<SceneId, React.ComponentType<SceneProps>> = {
  debt: dynamic(() => import("./debt/DebtScene"), {
    ssr: false,
    loading: Loading,
  }),
  backpack: dynamic(() => import("./backpack/BackpackScene"), {
    ssr: false,
    loading: Loading,
  }),
  yarn: dynamic(() => import("./yarn/YarnScene"), {
    ssr: false,
    loading: Loading,
  }),
  sand: dynamic(() => import("./sand/SandScene"), {
    ssr: false,
    loading: Loading,
  }),
  clay: dynamic(() => import("./clay/ClayScene"), {
    ssr: false,
    loading: Loading,
  }),
  war_map: dynamic(() => import("./war/WarMapScene"), {
    ssr: false,
    loading: Loading,
  }),
  unsaid: dynamic(() => import("./unsaid/UnsaidScene"), {
    ssr: false,
    loading: Loading,
  }),
};

export function SceneHost({
  id,
  input,
  topicNote,
  onExit,
  onEditInput,
}: {
  id: SceneId;
  input: SceneInput;
  topicNote?: string | null;
  onExit: (kind: SceneExit) => void;
  onEditInput?: () => void;
}) {
  return (
    <SceneShell
      meta={SCENES[id]}
      Scene={SCENE_COMPONENTS[id]}
      input={input}
      topicNote={topicNote}
      onExit={onExit}
      onEditInput={onEditInput}
    />
  );
}
