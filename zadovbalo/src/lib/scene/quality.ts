"use client";

export interface Quality {
  tier: "low" | "high";
  /** Верхня межа devicePixelRatio для canvas. */
  dpr: number;
}

/** Грубо оцінює потужність пристрою. Слабким — менший DPR і простіші ефекти. */
export function detectQuality(): Quality {
  if (typeof window === "undefined") return { tier: "high", dpr: 1 };
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  const low =
    (nav.deviceMemory !== undefined && nav.deviceMemory <= 4) ||
    (nav.hardwareConcurrency ?? 8) <= 4 ||
    nav.connection?.saveData === true;
  const dpr = Math.min(window.devicePixelRatio || 1, low ? 1.5 : 2);
  return { tier: low ? "low" : "high", dpr };
}
