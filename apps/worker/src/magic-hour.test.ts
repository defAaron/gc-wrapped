import { afterEach, describe, expect, it, vi } from "vitest";
import { createMagicHourClient } from "./magic-hour";

const apiKeyName = ["MAGIC_HOUR", "API_KEY"].join("_");

describe("createMagicHourClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends voice text inside style per current Magic Hour API", async () => {
    const previous = process.env[apiKeyName];
    process.env[apiKeyName] = "test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/ai-voice-generator") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as {
          style?: { prompt?: string; voice_name?: string };
        };
        expect(body.style?.prompt).toBe("Hello judges");
        expect(body.style?.voice_name).toBeTruthy();
        return new Response(JSON.stringify({ id: "audio-1", credits_charged: 1 }), { status: 200 });
      }
      if (url.includes("/audio-projects/audio-1")) {
        return new Response(
          JSON.stringify({ status: "complete", downloads: [{ url: "https://cdn.example/a.wav" }] }),
          { status: 200 },
        );
      }
      return new Response("not found", { status: 404 });
    });

    const client = createMagicHourClient();
    const created = await client.createVoiceLine({ lineId: "intro", text: "Hello judges" });
    expect(created.projectId).toBe("audio-1");
    const polled = await client.getProject("audio-1");
    expect(polled).toMatchObject({ status: "complete", downloadUrl: "https://cdn.example/a.wav" });
    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
    if (previous === undefined) delete process.env[apiKeyName];
    else process.env[apiKeyName] = previous;
  });

  it("sends text-to-video prompt inside style", async () => {
    const previous = process.env[apiKeyName];
    process.env[apiKeyName] = "test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "vid-1", credits_charged: 10 }), { status: 200 }),
    );
    const client = createMagicHourClient();
    await client.createTextToVideo({ lineId: "intro", prompt: "stage lights" });
    const call = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/text-to-video"));
    expect(call).toBeTruthy();
    const body = JSON.parse(String((call?.[1] as RequestInit).body)) as {
      style?: { prompt?: string };
      end_seconds?: number;
      model?: string;
      resolution?: string;
    };
    expect(body.style?.prompt).toBe("stage lights");
    expect(body.end_seconds).toBe(5);
    expect(body.model).toBe("ltx-2.5");
    expect(body.resolution).toBe("480p");
    fetchSpy.mockRestore();
    if (previous === undefined) delete process.env[apiKeyName];
    else process.env[apiKeyName] = previous;
  });
});
