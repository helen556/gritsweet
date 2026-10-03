import "server-only";
import type { Classifier } from "../types";
import { createCloudflareClassifier, readCloudflareConfig } from "./cloudflare";

/** null — AI не налаштований (немає токена тощо): тоді працює ручний вибір. */
export function getClassifier(env: NodeJS.ProcessEnv = process.env): Classifier | null {
  const provider = (env.AI_PROVIDER ?? "cloudflare").trim().toLowerCase();
  if (provider === "none" || provider === "off") return null;
  const config = readCloudflareConfig(env);
  return config ? createCloudflareClassifier(config) : null;
}

export function getTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const value = Number(env.AI_TIMEOUT_MS);
  return Number.isFinite(value) && value >= 1000 && value <= 30000 ? value : 9000;
}
