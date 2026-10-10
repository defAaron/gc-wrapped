import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import type { JevClient } from "@kudos/awards";
import { POST as createSession } from "./route";
import { GET, PATCH } from "./[id]/route";
import { POST as upload } from "./[id]/upload/route";
import { POST as analyze } from "./[id]/analyze/route";
import { setJevClientForTests } from "@/src/jev/provider";
import { resetDb } from "../../../vitest.setup";

const root = join(process.cwd(), "../..");
const sample = readFileSync(join(root, "fixtures/sample-apartment-4b.json"));
const proto = readFileSync(join(root, "fixtures/malicious/proto.json"));

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

describe("session api", () => {
  afterEach(async () => {
    setJevClientForTests(null);
    await resetDb();
  });

  it("runs the happy path without message archives in GET", async () => {
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
    const uploadRes = await upload(
      new NextRequest(`http://localhost:3000/api/sessions/${id}/upload`, {
        method: "POST",
        headers: withCookie(cookie, { "content-type": "application/json" }),
        body: sample,
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(uploadRes.status).toBe(200);

    await PATCH(
      new NextRequest(`http://localhost:3000/api/sessions/${id}`, {
        method: "PATCH",
        headers: withCookie(cookie),
        body: JSON.stringify({ consent: true }),
      }),
      { params: Promise.resolve({ id }) },
    );

    const analyzeRes = await analyze(
      new NextRequest(`http://localhost:3000/api/sessions/${id}/analyze`, {
        method: "POST",
        headers: withCookie(cookie),
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(analyzeRes.status).toBe(200);

    const getRes = await GET(
      new NextRequest(`http://localhost:3000/api/sessions/${id}`, { headers: withCookie(cookie) }),
      { params: Promise.resolve({ id }) },
    );
    const payload = await getRes.json();
    expect(getRes.status).toBe(200);
    expect(payload.analysis.awards.length).toBeLessThanOrEqual(18);
    expect(JSON.stringify(payload)).not.toContain('"messages"');
  });

  it("returns 404 without a cookie or with another cookie", async () => {
    const { id, cookie } = await create();
    const other = await create();
    const noCookie = await GET(
      new NextRequest(`http://localhost:3000/api/sessions/${id}`),
      { params: Promise.resolve({ id }) },
    );
    expect(noCookie.status).toBe(404);
    const wrongCookie = await GET(
      new NextRequest(`http://localhost:3000/api/sessions/${id}`, { headers: withCookie(other.cookie) }),
      { params: Promise.resolve({ id }) },
    );
    expect(wrongCookie.status).toBe(404);
    void cookie;
  });

  it("rate limits uploads after five in one hour", async () => {
    const { id, cookie } = await create();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await upload(
        new NextRequest(`http://localhost:3000/api/sessions/${id}/upload`, {
          method: "POST",
          headers: withCookie(cookie, { "content-type": "application/json" }),
          body: sample,
        }),
        { params: Promise.resolve({ id }) },
      );
      expect(response.status).toBe(200);
    }
    const sixth = await upload(
      new NextRequest(`http://localhost:3000/api/sessions/${id}/upload`, {
        method: "POST",
        headers: withCookie(cookie, { "content-type": "application/json" }),
        body: sample,
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(sixth.status).toBe(429);
  });

  it("blocks a bad origin on upload", async () => {
    const { id, cookie } = await create();
    const response = await upload(
      new NextRequest(`http://localhost:3000/api/sessions/${id}/upload`, {
        method: "POST",
        headers: { Cookie: cookie, Origin: "https://evil.example", Host: "localhost:3000" },
        body: sample,
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(403);
  });

  it("rejects malicious uploads and analyze without consent", async () => {
    const { id, cookie } = await create();
    const bad = await upload(
      new NextRequest(`http://localhost:3000/api/sessions/${id}/upload`, {
        method: "POST",
        headers: withCookie(cookie, { "content-type": "application/json" }),
        body: proto,
      }),
      { params: Promise.resolve({ id }) },
    );
    const badBody = await bad.json();
    expect(bad.status).toBe(400);
    expect(badBody.code).toBe("MALICIOUS_CONTENT");

    await upload(
      new NextRequest(`http://localhost:3000/api/sessions/${id}/upload`, {
        method: "POST",
        headers: withCookie(cookie, { "content-type": "application/json" }),
        body: sample,
      }),
      { params: Promise.resolve({ id }) },
    );
    const analyzeRes = await analyze(
      new NextRequest(`http://localhost:3000/api/sessions/${id}/analyze`, {
        method: "POST",
        headers: withCookie(cookie),
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(analyzeRes.status).toBe(400);
  });

  it("rate limits the third regenerate", async () => {
    setJevClientForTests({ decide: async () => ({ answers: {}, usage: { input_tokens: 1 } }) });
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
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await analyze(
        new NextRequest(`http://localhost:3000/api/sessions/${id}/analyze`, {
          method: "POST",
          headers: withCookie(cookie),
          body: JSON.stringify({ regenerate: true }),
        }),
        { params: Promise.resolve({ id }) },
      );
      expect(response.status).toBe(200);
    }
    const third = await analyze(
      new NextRequest(`http://localhost:3000/api/sessions/${id}/analyze`, {
        method: "POST",
        headers: withCookie(cookie),
        body: JSON.stringify({ regenerate: true }),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(third.status).toBe(429);
  });
});
