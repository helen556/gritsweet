import { loadImage, loadJson } from "@/lib/scene/assets";
import type { NoteKind } from "@/lib/scenes/debt";

export interface NoteArt {
  img: CanvasImageSource;
  w: number;
  h: number;
}

interface MoneyManifest {
  notes: Record<string, { w: number; h: number }>;
}

export async function loadMoneyManifest() {
  return loadJson<MoneyManifest>("/scenes/money/money.json");
}

/** Справжня купюра з наданих матеріалів (1000 грн). Нейтральних замінників і валют, окрім гривні, немає. */
export async function loadNote(kind: NoteKind, manifest: MoneyManifest): Promise<NoteArt> {
  const m = manifest.notes[kind];
  if (!m) throw new Error(`немає купюри ${kind}`);
  return { img: await loadImage(`/scenes/money/${kind}.webp`), w: m.w, h: m.h };
}
