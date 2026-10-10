import { describe, expect, it, vi } from "vitest";
import { logEvent } from "./log";

describe("logEvent", () => {
  it("redacts sensitive keys", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logEvent("test_event", {
      sessionId: "abc",
      text: "secret message",
      authorization: "Bearer token",
      cookie: "kudos_sid=1",
    });
    const payload = spy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.sessionId).toBe("abc");
    expect(payload.text).toBeUndefined();
    expect(payload.authorization).toBeUndefined();
    expect(payload.cookie).toBeUndefined();
    spy.mockRestore();
  });
});
