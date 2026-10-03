import { loadImage, loadJson } from "@/lib/scene/assets";
import type { NoteKind } from "@/lib/scenes/debt";

export interface NoteArt {
  img: CanvasImageSource;
  w: number;
  h: number;
  /** Чесний підпис, якщо купюра нейтральна. */
  neutral: boolean;
}

interface MoneyManifest {
  notes: Record<string, { w: number; h: number }>;
}

export async function loadMoneyManifest() {
  return loadJson<MoneyManifest>("/scenes/money/money.json");
}

/**
 * Нейтральна символічна купюра: папір, тонкий орнамент, номінал і напис «символічна».
 * Свідомо не схожа на жодну справжню валюту.
 */
export function neutralNote(label: string): NoteArt {
  const W = 640;
  const H = 300;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#ddd6c6");
  bg.addColorStop(1, "#c9c1ae");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // зерно паперу
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    d[i] = d[i]! + n;
    d[i + 1] = d[i + 1]! + n;
    d[i + 2] = d[i + 2]! + n;
  }
  g.putImageData(img, 0, 0);
  // орнамент
  g.strokeStyle = "rgba(90,82,70,0.22)";
  g.lineWidth = 1;
  for (let k = 0; k < 18; k++) {
    g.beginPath();
    for (let x = 0; x <= W; x += 6) {
      const y = 40 + k * 12 + Math.sin(x / 22 + k * 0.6) * 6;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.strokeStyle = "rgba(70,62,52,0.6)";
  g.lineWidth = 3;
  g.strokeRect(14, 14, W - 28, H - 28);
  g.lineWidth = 1;
  g.strokeRect(24, 24, W - 48, H - 48);
  g.fillStyle = "rgba(225,218,204,0.85)";
  g.fillRect(W / 2 - 200, H / 2 - 62, 400, 124);
  g.fillStyle = "#3d3830";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = "600 76px Georgia, 'Times New Roman', serif";
  g.fillText(label, W / 2, H / 2 - 8, 380);
  g.font = "500 22px system-ui, sans-serif";
  g.fillStyle = "#5c554a";
  g.fillText("символічна купюра", W / 2, H / 2 + 46);
  return { img: c, w: W, h: H, neutral: true };
}

export async function loadNote(kind: NoteKind, neutralLabel: string, manifest: MoneyManifest): Promise<NoteArt> {
  if (kind !== "neutral" && manifest.notes[kind]) {
    const m = manifest.notes[kind]!;
    return { img: await loadImage(`/scenes/money/${kind}.webp`), w: m.w, h: m.h, neutral: false };
  }
  return neutralNote(neutralLabel);
}
