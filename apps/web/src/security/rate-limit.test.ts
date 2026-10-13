import { describe, expect, it } from "vitest";
import { isRateLimitDisabled } from "./rate-limit";

describe("isRateLimitDisabled", () => {
  it("is off in test so IP buckets apply in vitest", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(isRateLimitDisabled()).toBe(false);
  });
});
