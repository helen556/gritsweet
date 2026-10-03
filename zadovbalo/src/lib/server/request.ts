import "server-only";

export function newRequestId(): string {
  return crypto.randomUUID();
}

export const noStoreHeaders = { "Cache-Control": "no-store" } as const;
