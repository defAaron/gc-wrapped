import { describe, expect, it, vi } from "vitest";
import { HttpJevClient, JevMaxTokensError } from "./client";

const apiKeyName = ["TYPESAFE", "API_KEY"].join("_");

describe("HttpJevClient", () => {
  it("throws before any request when the key is missing", async () => {
    const previous = process.env[apiKeyName];
    delete process.env[apiKeyName];
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(
      new HttpJevClient().decide({ model: "jev-1.13.0", state: { secret: "do-not-log" }, questions: {} }),
    ).rejects.toThrow("JEV_NOT_CONFIGURED");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    if (previous === undefined) delete process.env[apiKeyName];
    else process.env[apiKeyName] = previous;
  });

  it("turns a max token response into a retryable error", async () => {
    const previous = process.env[apiKeyName];
    process.env[apiKeyName] = "test-only";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("max_tokens_exceeded", { status: 400 }),
    );
    await expect(
      new HttpJevClient().decide({ model: "jev-1.13.0", state: {}, questions: {} }),
    ).rejects.toBeInstanceOf(JevMaxTokensError);
    expect(fetchSpy).toHaveBeenCalledOnce();
    fetchSpy.mockRestore();
    if (previous === undefined) delete process.env[apiKeyName];
    else process.env[apiKeyName] = previous;
  });
});
