import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import type { JevClient } from "@kudos/awards";
import { POST as createSession } from "./route";
import { PATCH } from "./[id]/route";
import { POST as upload } from "./[id]/upload/route";
import { POST as analyze } from "./[id]/analyze/route";
import { POST as startCeremony } from "./[id]/ceremony/route";
import { GET as ceremonyStatus } from "./[id]/status/route";
import { GET as ceremonyVideo } from "./[id]/video/route";
import { setJevClientForTests } from "@/src/jev/provider";
import { resetDb } from "../../../vitest.setup";

const root = join(process.cwd(), "../..");
const sample = readFileSync(join(root, "fixtures/sample-apartment-4b.json"));

process.env.CEREMONY_PROVIDER = "fallback";
process.env.CEREMONY_INLINE = "1";

async function ffmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

function originHeaders(): HeadersInit {
  return { Origin: "http://localhost:3000", Host: "localhost:3000" };
}

function withCookie(cookie: string, extra: HeadersInit = {}): HeadersInit {
  return { ...originHeaders(), Cookie: cookie, ...extra };
}

async function create(): Promise<{ id: string; cookie: string }> {
  const response = await createSession(
    new NextRequest("http://localhost:3000/api/sessions", { method: "POST", headers: originHeaders() }),
  );
  const body = (await response.json()) as { sessionId: string };
  const token = response.cookies.get("kudos_sid")?.value;
  if (!token) throw new Error("missing cookie");
  return { id: body.sessionId, cookie: `kudos_sid=${token}` };
}

describe("ceremony api", () => {
  afterEach(async () => {
    setJevClientForTests(null);
    await resetDb();
  });

  it("renders slideshow fallback and serves mp4", async () => {
    const hasFfmpeg = await ffmpegAvailable();
    if (!hasFfmpeg && !process.env.CI) return;

    const fake: JevClient = {
      decide: async () => ({
        answers: {
          funniest_winner: { type: "choice", choice: "alex", confidence: 0.9 },
          funniest_confidence_gate: { type: "noul", noul: 0.9 },
        },
        usage: { input_tokens: 10 },
      }),
    };
    setJevClientForTests(fake);
    const { id, cookie } = await create();

    await upload(
      new NextRequest(`http://localhost:3000/api/sessions/${id}/upload`, {
        method: "POST",
        headers: withCookie(cookie, { "content-type": "application/json" }),
        body: sample,
      }),
      { params: Promise.resolve({ id }) },
    );

    await PATCH(
      new NextRequest(`http://localhost:3000/api/sessions/${id}`, {
        method: "PATCH",
        headers: withCookie(cookie),
        body: JSON.stringify({ consent: true }),
      }),
      { params: Promise.resolve({ id }) },
    );

    await analyze(
      new NextRequest(`http://localhost:3000/api/sessions/${id}/analyze`, {
        method: "POST",
        headers: withCookie(cookie),
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id }) },
    );

    const ceremonyRes = await startCeremony(
      new NextRequest(`http://localhost:3000/api/sessions/${id}/ceremony`, {
        method: "POST",
        headers: withCookie(cookie),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(ceremonyRes.status).toBe(202);

    const statusRes = await ceremonyStatus(
      new NextRequest(`http://localhost:3000/api/sessions/${id}/status`, { headers: withCookie(cookie) }),
      { params: Promise.resolve({ id }) },
    );
    const statusBody = await statusRes.json();
    expect(statusRes.status).toBe(200);
    expect(statusBody.status).toBe("complete");

    const videoRes = await ceremonyVideo(
      new NextRequest(`http://localhost:3000/api/sessions/${id}/video`, { headers: withCookie(cookie) }),
      { params: Promise.resolve({ id }) },
    );
    expect(videoRes.status).toBe(200);
    expect(videoRes.headers.get("content-type")).toBe("video/mp4");
    const videoBytes = Buffer.from(await videoRes.arrayBuffer());
    expect(videoBytes.byteLength).toBeGreaterThan(0);
  });
});
