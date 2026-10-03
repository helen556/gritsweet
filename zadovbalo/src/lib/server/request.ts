import "server-only";

export function newRequestId(): string {
  return crypto.randomUUID();
}

/** IP лише для rate limit у пам’яті; ніде не логуємо й не зберігаємо. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

export const noStoreHeaders = { "Cache-Control": "no-store" } as const;
