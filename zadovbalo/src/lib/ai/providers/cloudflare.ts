import "server-only";
import { SYSTEM_PROMPT, userMessage } from "../prompt";
import { modelOutputJsonSchema } from "../schema";
import { AiError, type Classifier } from "../types";

export interface CloudflareConfig {
  accountId: string;
  apiToken: string;
  model: string;
  fetchImpl?: typeof fetch;
}

/** Документовано для JSON Mode; замінюється через CLOUDFLARE_AI_MODEL. */
export const DEFAULT_CLOUDFLARE_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const MODEL_RE = /^@(cf|hf)\/[\w.-]+\/[\w.-]+$/;

export function readCloudflareConfig(env: NodeJS.ProcessEnv = process.env): CloudflareConfig | null {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = env.CLOUDFLARE_API_TOKEN?.trim();
  const model = env.CLOUDFLARE_AI_MODEL?.trim() || DEFAULT_CLOUDFLARE_MODEL;
  if (!accountId || !apiToken || !/^[a-f0-9]{32}$/.test(accountId) || !MODEL_RE.test(model)) return null;
  return { accountId, apiToken, model };
}

/** Відповідь /ai/run: { success, result: { response: object | string }, errors }. */
function extractResponse(body: unknown): unknown {
  if (!body || typeof body !== "object") throw new AiError("invalid_response");
  const result = (body as { result?: { response?: unknown } }).result;
  const response = result?.response;
  if (typeof response === "string") {
    try {
      return JSON.parse(response);
    } catch {
      throw new AiError("invalid_response");
    }
  }
  if (response && typeof response === "object") return response;
  throw new AiError("invalid_response");
}

function mapStatus(status: number, body: unknown): AiError {
  const text = JSON.stringify(body ?? "").toLowerCase();
  if (status === 401 || status === 403) return new AiError("auth", status);
  if (status === 429) return new AiError(text.includes("neuron") || text.includes("quota") || text.includes("limit") ? "quota" : "rate_limited", status);
  if (status >= 500) return new AiError("unavailable", status);
  // «JSON Mode couldn't be met» та інші 4xx щодо формату
  return new AiError("invalid_response", status);
}

export function createCloudflareClassifier(config: CloudflareConfig): Classifier {
  const doFetch = config.fetchImpl ?? fetch;
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${config.model}`;

  async function once(text: string, signal: AbortSignal) {
    let res: Response;
    try {
      res = await doFetch(url, {
        method: "POST",
        signal,
        headers: { Authorization: `Bearer ${config.apiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage(text) },
          ],
          response_format: { type: "json_schema", json_schema: modelOutputJsonSchema },
          temperature: 0,
          max_tokens: 200,
        }),
      });
    } catch (error) {
      if (signal.aborted) throw new AiError("timeout");
      throw Object.assign(new AiError("unavailable"), { retryable: true, cause: error });
    }
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const err = mapStatus(res.status, body);
      throw Object.assign(err, { retryable: res.status >= 500 });
    }
    return extractResponse(body);
  }

  return {
    id: `cloudflare:${config.model}`,
    async classify(text, signal) {
      try {
        return await once(text, signal);
      } catch (error) {
        // Один повтор лише для тимчасових збоїв; 4xx/429/квоту не повторюємо, щоб не палити ліміт.
        if (error instanceof AiError && (error as AiError & { retryable?: boolean }).retryable && !signal.aborted) {
          await new Promise((r) => setTimeout(r, 400));
          if (signal.aborted) throw new AiError("timeout");
          return once(text, signal);
        }
        throw error;
      }
    },
  };
}
