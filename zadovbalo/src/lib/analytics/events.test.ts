import { describe, expect, it } from "vitest";
import { analyticsPayloadSchema } from "./events";

describe("analytics payload", () => {
  it("accepts only bare known events", () => {
    expect(analyticsPayloadSchema.safeParse({ event: "scene_started" }).success).toBe(true);
    expect(analyticsPayloadSchema.safeParse({ event: "scene_started", scene: "debt" }).success).toBe(false);
    expect(analyticsPayloadSchema.safeParse({ event: "text_submitted", text: "мій борг" }).success).toBe(false);
  });
});
