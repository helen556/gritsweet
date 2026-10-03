import { describe, expect, it } from "vitest";
import { analyticsPayloadSchema } from "./events";

describe("analytics payload", () => {
  it("accepts known ids", () => {
    expect(analyticsPayloadSchema.safeParse({ event: "topic_selected", category: "work" }).success).toBe(true);
  });
  it("rejects free text and unknown fields", () => {
    expect(analyticsPayloadSchema.safeParse({ event: "input_text", text: "мене бісить шеф" }).success).toBe(false);
    expect(analyticsPayloadSchema.safeParse({ event: "topic_selected", category: "мій шеф" }).success).toBe(false);
  });
});
