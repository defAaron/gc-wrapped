import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { getDb } from "@/src/db";
import { analyses, awards, sessions } from "@/src/db/schema";
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

  it("publishes a single exemplar quote when the owner opts in", async () => {
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
    const db = getDb();
    const analysis = await db.query.analyses.findFirst({ where: eq(analyses.sessionId, sessionId) });
    if (!analysis) throw new Error("analysis missing");
    const awardRows = await db.query.awards.findMany({ where: eq(awards.analysisId, analysis.id) });
    const first = awardRows[0];
    if (!first) throw new Error("award missing");
    await db.update(awards).set({ exemplarQuote: null }).where(eq(awards.analysisId, analysis.id));
    await db.update(awards).set({ exemplarQuote: "coffee run" }).where(eq(awards.id, first.id));
    await PATCH(
      new NextRequest(`http://localhost:3000/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: headers(cookie),
        body: JSON.stringify({ quotesPublic: true }),
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
    const response = await publicShare(new NextRequest(`http://localhost:3000/api/s/${slug}`), {
      params: Promise.resolve({ slug }),
    });
    const json = (await response.json()) as { awards: { exemplarQuote?: string }[] };
    const quoted = json.awards.filter((award) => award.exemplarQuote);
    expect(quoted).toHaveLength(1);
    expect(quoted[0]?.exemplarQuote).toBe("coffee run");
    expect(JSON.stringify(json)).not.toContain('"messages"');
    await db.update(sessions).set({ quotesPublic: false }).where(eq(sessions.id, sessionId));
    const again = await publicShare(new NextRequest(`http://localhost:3000/api/s/${slug}`), {
      params: Promise.resolve({ slug }),
    });
    expect(JSON.stringify(await again.json())).not.toContain("exemplarQuote");
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
