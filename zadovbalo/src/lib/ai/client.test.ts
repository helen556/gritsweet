import { describe, expect, it } from "vitest";
import { createAnalyzer } from "./client";

const json = (body: unknown, delay = 0) => () =>
  new Promise<Response>((resolve) => setTimeout(() => resolve(new Response(JSON.stringify(body))), delay));

describe("createAnalyzer", () => {
  it("ignores a late response after a newer request", async () => {
    const replies = [json({ status: "support", reason: "safety" }, 40), json({ status: "support", reason: "model" }, 5)];
    let i = 0;
    const a = createAnalyzer((async (_u: unknown, init?: RequestInit) => {
      const r = replies[i++]!;
      return new Promise<Response>((resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        void r().then(resolve);
      });
    }) as typeof fetch);
    const first = a.analyze("старий текст");
    const second = a.analyze("новий текст");
    expect(await first).toEqual({ status: "stale" });
    expect(await second).toEqual({ status: "support", reason: "model" });
  });

  it("cancel() makes the pending result stale", async () => {
    const a = createAnalyzer((async () => json({ status: "support", reason: "model" }, 20)()) as typeof fetch);
    const p = a.analyze("текст");
    a.cancel();
    expect(await p).toEqual({ status: "stale" });
  });

  it("network failure → manual offline, garbage → manual invalid_response", async () => {
    const down = createAnalyzer((async () => Promise.reject(new TypeError("Failed to fetch"))) as typeof fetch);
    expect(await down.analyze("x y")).toMatchObject({ status: "manual", reason: "offline" });
    const junk = createAnalyzer((async () => new Response("<html>")) as typeof fetch);
    expect(await junk.analyze("x y")).toMatchObject({ status: "manual", reason: "invalid_response" });
  });
});
