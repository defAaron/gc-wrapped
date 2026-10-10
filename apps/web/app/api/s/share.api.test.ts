import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as createSession } from "../sessions/route";
import { PATCH } from "../sessions/[id]/route";
import { POST as upload } from "../sessions/[id]/upload/route";
import { POST as analyze } from "../sessions/[id]/analyze/route";
import { POST as publish } from "../sessions/[id]/publish/route";
import { GET as publicShare } from "./[slug]/route";
import { POST as report } from "./[slug]/report/route";
import { setJevClientForTests } from "@/src/jev/provider";
import { resetDb } from "../../../vitest.setup";

const sample = readFileSync(join(process.cwd(), "../../fixtures/sample-apartment-4b.json"));

function headers(cookie: string): HeadersInit {
  return { Cookie: cookie, Origin: "http://localhost:3000", Host: "localhost:3000" };
}

describe("public share api", () => {
  it("omits quotes and message archives", async () => {
    await resetDb();
    setJevClientForTests({ decide: async () => ({ answers: {}, usage: { input_tokens: 1 } }) });
    const create = await createSession(
      new NextRequest("http://localhost:3000/api/sessions", { method: "POST", headers: headers("") }),
    );
    const { sessionId } = (await create.json()) as { sessionId: string };
    const cookie = `kudos_sid=${create.cookies.get("kudos_sid")?.value}`;
    await upload(
      new NextRequest(`http://localhost:3000/api/sessions/${sessionId}/upload`, {
        method: "POST",
        headers: { ...headers(cookie), "content-type": "application/json" },
        body: sample,
      }),
      { params: Promise.resolve({ id: sessionId }) },
    );
    await PATCH(
      new NextRequest(`http://localhost:3000/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: headers(cookie),
        body: JSON.stringify({ consent: true }),
      }),
      { params: Promise.resolve({ id: sessionId }) },
    );
    await analyze(
      new NextRequest(`http://localhost:3000/api/sessions/${sessionId}/analyze`, {
        method: "POST",
        headers: headers(cookie),
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: sessionId }) },
    );
    const published = await publish(
      new NextRequest(`http://localhost:3000/api/sessions/${sessionId}/publish`, {
        method: "POST",
        headers: headers(cookie),
      }),
      { params: Promise.resolve({ id: sessionId }) },
    );
    const { slug } = (await published.json()) as { slug: string };
    const response = await publicShare(
      new NextRequest(`http://localhost:3000/api/s/${slug}`),
      { params: Promise.resolve({ slug }) },
    );
    const json = await response.json();
    const text = JSON.stringify(json);
    expect(text).not.toContain("exemplarQuote");
    expect(text).not.toContain('"messages"');
    expect(json.videoUrl).toBeNull();
    expect(json.watermark).toBe("Kudos AI");
  });

  it("rate limits share reports", async () => {
    await resetDb();
    setJevClientForTests({ decide: async () => ({ answers: {}, usage: { input_tokens: 1 } }) });
    const create = await createSession(
      new NextRequest("http://localhost:3000/api/sessions", { method: "POST", headers: headers("") }),
    );
    const { sessionId } = (await create.json()) as { sessionId: string };
    const cookie = `kudos_sid=${create.cookies.get("kudos_sid")?.value}`;
    await upload(
      new NextRequest(`http://localhost:3000/api/sessions/${sessionId}/upload`, {
        method: "POST",
        headers: { ...headers(cookie), "content-type": "application/json" },
        body: sample,
      }),
      { params: Promise.resolve({ id: sessionId }) },
    );
    await PATCH(
      new NextRequest(`http://localhost:3000/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: headers(cookie),
        body: JSON.stringify({ consent: true }),
      }),
      { params: Promise.resolve({ id: sessionId }) },
    );
    await analyze(
      new NextRequest(`http://localhost:3000/api/sessions/${sessionId}/analyze`, {
        method: "POST",
        headers: headers(cookie),
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: sessionId }) },
    );
    const published = await publish(
      new NextRequest(`http://localhost:3000/api/sessions/${sessionId}/publish`, {
        method: "POST",
        headers: headers(cookie),
      }),
      { params: Promise.resolve({ id: sessionId }) },
    );
    const { slug } = (await published.json()) as { slug: string };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await report(
        new NextRequest(`http://localhost:3000/api/s/${slug}/report`, {
          method: "POST",
          headers: headers(""),
          body: JSON.stringify({ reason: "test" }),
        }),
        { params: Promise.resolve({ slug }) },
      );
      expect(response.status).toBe(200);
    }
    const sixth = await report(
      new NextRequest(`http://localhost:3000/api/s/${slug}/report`, {
        method: "POST",
        headers: headers(""),
        body: JSON.stringify({ reason: "test" }),
      }),
      { params: Promise.resolve({ slug }) },
    );
    expect(sixth.status).toBe(429);
  });
});
