import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import type { JevClient } from "@kudos/awards";
import type { MagicHourClient } from "@kudos/worker/process";
import { renderFixtureClip } from "@kudos/worker/concat";
import { setAssetDownloaderForTests, setMagicHourClientForTests } from "@kudos/worker/process";
import { createObjectStore } from "@kudos/storage";
import { POST as createSession } from "./route";
import { PATCH } from "./[id]/route";
import { POST as upload } from "./[id]/upload/route";
import { POST as analyze } from "./[id]/analyze/route";
import { POST as startCeremony } from "./[id]/ceremony/route";
import { setJevClientForTests } from "@/src/jev/provider";
import { getDb } from "@/src/db";
import { ceremonies } from "@/src/db/schema";
import { resetDb } from "../../../vitest.setup";

const root = join(process.cwd(), "../..");
const sample = readFileSync(join(root, "fixtures/sample-apartment-4b.json"));

function originHeaders(): HeadersInit {
  return { Origin: "http://localhost:3000", Host: "localhost:3000" };
}

function withCookie(cookie: string, extra: HeadersInit = {}): HeadersInit {
  return { ...originHeaders(), Cookie: cookie, ...extra };
}

async function ffmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

describe("magic hour ceremony pipeline", () => {
  afterEach(async () => {
    setJevClientForTests(null);
    setMagicHourClientForTests(null);
    setAssetDownloaderForTests(null);
    process.env.CEREMONY_PROVIDER = "fallback";
    await resetDb();
  });

  it("stores clips in script order and does not fall back", async () => {
    if (!(await ffmpegAvailable()) && !process.env.CI) return;
    process.env.CEREMONY_PROVIDER = "live";
    process.env.CEREMONY_INLINE = "1";
    const clip = await renderFixtureClip();
    const calls: string[] = [];
    let videoInFlight = 0;
    const client: MagicHourClient = {
      async createVoiceLine({ lineId }) {
        calls.push(`tts:${lineId}`);
        return { projectId: `tts-${lineId}`, credits: 1 };
      },
      async createTextToVideo({ lineId }) {
        videoInFlight += 1;
        expect(videoInFlight).toBeLessThanOrEqual(3);
        calls.push(`ttv:${lineId}`);
        return { projectId: `ttv-${lineId}`, credits: 2 };
      },
      async createTalkingPhoto({ lineId, imageUrl, audioUrl }) {
        videoInFlight += 1;
        expect(videoInFlight).toBeLessThanOrEqual(3);
        expect(imageUrl.startsWith("https://")).toBe(true);
        expect(audioUrl.startsWith("https://")).toBe(true);
        calls.push(`talk:${lineId}`);
        return { projectId: `talk-${lineId}`, credits: 3 };
      },
      async getProject(projectId) {
        if (projectId.startsWith("ttv-") || projectId.startsWith("talk-")) {
          videoInFlight = Math.max(0, videoInFlight - 1);
        }
        return { status: "complete", downloadUrl: `https://downloads.example/${projectId}` };
      },
    };
    setMagicHourClientForTests(client);
    setAssetDownloaderForTests(async () => clip);

    const fake: JevClient = {
      decide: async () => ({
        answers: {},
        usage: { input_tokens: 10 },
      }),
    };
    setJevClientForTests(fake);

    const response = await createSession(
      new NextRequest("http://localhost:3000/api/sessions", { method: "POST", headers: originHeaders() }),
    );
    const { sessionId } = (await response.json()) as { sessionId: string };
    const token = response.cookies.get("kudos_sid")?.value;
    if (!token) throw new Error("missing cookie");
    const cookie = `kudos_sid=${token}`;

    await upload(
      new NextRequest(`http://localhost:3000/api/sessions/${sessionId}/upload`, {
        method: "POST",
        headers: withCookie(cookie, { "content-type": "application/json" }),
        body: sample,
      }),
      { params: Promise.resolve({ id: sessionId }) },
    );
    await PATCH(
      new NextRequest(`http://localhost:3000/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: withCookie(cookie),
        body: JSON.stringify({ consent: true }),
      }),
      { params: Promise.resolve({ id: sessionId }) },
    );
    await analyze(
      new NextRequest(`http://localhost:3000/api/sessions/${sessionId}/analyze`, {
        method: "POST",
        headers: withCookie(cookie),
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: sessionId }) },
    );

    const ceremonyRes = await startCeremony(
      new NextRequest(`http://localhost:3000/api/sessions/${sessionId}/ceremony`, {
        method: "POST",
        headers: withCookie(cookie),
      }),
      { params: Promise.resolve({ id: sessionId }) },
    );
    expect(ceremonyRes.status).toBe(202);

    const firstVideo = calls.findIndex((call) => call.startsWith("ttv:") || call.startsWith("talk:"));
    const lastTts = calls.reduce((index, call, current) => (call.startsWith("tts:") ? current : index), -1);
    expect(lastTts).toBeGreaterThanOrEqual(0);
    expect(firstVideo).toBeGreaterThan(lastTts);

    const store = createObjectStore();
    expect(calls.some((call) => call.startsWith("tts:headline_"))).toBe(true);
    expect(calls).not.toContain("tts:intro");
    expect(await store.get(`sessions/${sessionId}/clips/intro.mp4`)).toBeTruthy();
    expect(await store.get(`sessions/${sessionId}/final.mp4`)).toBeTruthy();

    const ceremony = await getDb().query.ceremonies.findFirst({ where: eq(ceremonies.sessionId, sessionId) });
    expect(ceremony?.fallbackUsed).toBe(false);
    expect(ceremony?.mhCreditsTotal).toBeGreaterThan(0);
    expect(ceremony?.videoExpiresAt).toBeTruthy();
  });

  it("does not call magic hour when the slideshow fallback is selected", async () => {
    if (!(await ffmpegAvailable()) && !process.env.CI) return;
    process.env.CEREMONY_PROVIDER = "fallback";
    let called = false;
    const client: MagicHourClient = {
      async createVoiceLine() {
        called = true;
        return { projectId: "nope" };
      },
      async createTextToVideo() {
        called = true;
        return { projectId: "nope" };
      },
      async createTalkingPhoto() {
        called = true;
        return { projectId: "nope" };
      },
      async getProject() {
        called = true;
        return { status: "failed" };
      },
    };
    setMagicHourClientForTests(client);
    setJevClientForTests({ decide: async () => ({ answers: {}, usage: { input_tokens: 1 } }) });

    const response = await createSession(
      new NextRequest("http://localhost:3000/api/sessions", { method: "POST", headers: originHeaders() }),
    );
    const { sessionId } = (await response.json()) as { sessionId: string };
    const token = response.cookies.get("kudos_sid")?.value;
    if (!token) throw new Error("missing cookie");
    const cookie = `kudos_sid=${token}`;
    await upload(
      new NextRequest(`http://localhost:3000/api/sessions/${sessionId}/upload`, {
        method: "POST",
        headers: withCookie(cookie, { "content-type": "application/json" }),
        body: sample,
      }),
      { params: Promise.resolve({ id: sessionId }) },
    );
    await PATCH(
      new NextRequest(`http://localhost:3000/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: withCookie(cookie),
        body: JSON.stringify({ consent: true }),
      }),
      { params: Promise.resolve({ id: sessionId }) },
    );
    await analyze(
      new NextRequest(`http://localhost:3000/api/sessions/${sessionId}/analyze`, {
        method: "POST",
        headers: withCookie(cookie),
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: sessionId }) },
    );
    await startCeremony(
      new NextRequest(`http://localhost:3000/api/sessions/${sessionId}/ceremony`, {
        method: "POST",
        headers: withCookie(cookie),
      }),
      { params: Promise.resolve({ id: sessionId }) },
    );
    expect(called).toBe(false);
    const ceremony = await getDb().query.ceremonies.findFirst({ where: eq(ceremonies.sessionId, sessionId) });
    expect(ceremony?.fallbackUsed).toBe(true);
  });
});
