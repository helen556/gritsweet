"use client";

import type { AnalyzeErrorCode, AnalyzeResponse } from "./contract";

export type ClientAnalyzeError = AnalyzeErrorCode | "network";
export type ClientAnalyzeResult = Exclude<AnalyzeResponse, { status: "error" }> | { status: "error"; error: ClientAnalyzeError };

const CLIENT_TIMEOUT_MS = 20_000;

/** Текст іде лише на /api/analyze і ніде не кешується (no-store). */
export async function requestAnalysis(text: string): Promise<ClientAnalyzeResult> {
  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      cache: "no-store",
      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
    });
    const data = (await res.json().catch(() => null)) as AnalyzeResponse | null;
    if (!data || typeof data !== "object" || !("status" in data)) return { status: "error", error: res.ok ? "invalid_response" : "ai_unavailable" };
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") return { status: "error", error: "timeout" };
    return { status: "error", error: "network" };
  }
}
