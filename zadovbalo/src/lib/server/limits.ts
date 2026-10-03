import "server-only";

/** Лічильник із TTL. Для лімітів між serverless-інстансами потрібне спільне сховище. */
export interface CounterStore {
  readonly shared: boolean;
  incr(key: string, ttlSeconds: number): Promise<number>;
}

/** Upstash Redis REST (також Vercel KV: KV_REST_API_URL / KV_REST_API_TOKEN). Без SDK, лише fetch. */
export function createUpstashStore(url: string, token: string, fetchImpl: typeof fetch = fetch): CounterStore {
  const base = url.replace(/\/$/, "");
  return {
    shared: true,
    async incr(key, ttlSeconds) {
      const res = await fetchImpl(`${base}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify([
          ["INCR", key],
          ["EXPIRE", key, String(ttlSeconds), "NX"],
        ]),
        signal: AbortSignal.timeout(1500),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`limit store ${res.status}`);
      const data = (await res.json()) as { result?: unknown; error?: string }[];
      const count = Number(data[0]?.result);
      if (!Number.isFinite(count)) throw new Error("limit store bad reply");
      return count;
    },
  };
}

/** Лише для розробки / одного інстансу. */
export function createMemoryStore(): CounterStore {
  const map = new Map<string, { n: number; exp: number }>();
  return {
    shared: false,
    async incr(key, ttlSeconds) {
      const now = Date.now();
      if (map.size > 10000) for (const [k, v] of map) if (v.exp <= now) map.delete(k);
      const e = map.get(key);
      if (!e || e.exp <= now) {
        map.set(key, { n: 1, exp: now + ttlSeconds * 1000 });
        return 1;
      }
      e.n += 1;
      return e.n;
    },
  };
}

let memory: CounterStore | null = null;

export function getCounterStore(env: NodeJS.ProcessEnv = process.env): CounterStore {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  if (url && token) return createUpstashStore(url, token);
  return (memory ??= createMemoryStore());
}

const int = (v: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

export function readLimits(env: NodeJS.ProcessEnv = process.env) {
  return {
    perMinute: int(env.AI_RATE_PER_MINUTE, 6, 1, 120),
    perDayPerClient: int(env.AI_RATE_PER_DAY, 40, 1, 5000),
    dailyBudget: int(env.AI_DAILY_REQUEST_LIMIT, 150, 0, 100000),
    // У продакшені без спільного сховища AI вимкнено (ліміти в памʼяті не працюють між інстансами).
    requireShared: env.NODE_ENV === "production" && env.ALLOW_INSTANCE_LOCAL_LIMITS !== "true",
  };
}

export type LimitVerdict = "ok" | "rate_limited" | "budget" | "limits_unavailable";

/** Перевіряє частоту для клієнта й загальний добовий бюджет. Помилка сховища = AI не викликаємо. */
export async function checkAiLimits(
  clientId: string,
  { store = getCounterStore(), limits = readLimits(), now = new Date() }: { store?: CounterStore; limits?: ReturnType<typeof readLimits>; now?: Date } = {},
): Promise<LimitVerdict> {
  if (limits.requireShared && !store.shared) return "limits_unavailable";
  const minute = Math.floor(now.getTime() / 60000);
  const day = now.toISOString().slice(0, 10);
  try {
    if ((await store.incr(`vd:m:${clientId}:${minute}`, 70)) > limits.perMinute) return "rate_limited";
    if ((await store.incr(`vd:d:${clientId}:${day}`, 90000)) > limits.perDayPerClient) return "rate_limited";
    if ((await store.incr(`vd:budget:${day}`, 90000)) > limits.dailyBudget) return "budget";
    return "ok";
  } catch {
    return "limits_unavailable";
  }
}

/** Анонімний ідентифікатор клієнта: хеш IP. Сам IP ніде не зберігається. */
export async function clientIdFor(request: Request, salt = process.env.RATE_LIMIT_SALT ?? ""): Promise<string> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${ip}`));
  return Buffer.from(digest).toString("hex").slice(0, 32);
}

/** Простий ліміт для дешевих маршрутів (події, транскрипція). Збій сховища тут не блокує. */
export async function allowRequest(clientId: string, bucket: string, limit: number, windowSeconds: number, store = getCounterStore()) {
  const slot = Math.floor(Date.now() / (windowSeconds * 1000));
  try {
    return (await store.incr(`vd:${bucket}:${clientId}:${slot}`, windowSeconds + 5)) <= limit;
  } catch {
    return true;
  }
}
