import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as createSession } from "../../app/api/sessions/route";
import { POST as upload } from "../../app/api/sessions/[id]/upload/route";
import { getDb } from "../db";
import { analyses, awards, ceremonies, members, rateLimitBuckets, sessions } from "../db/schema";
import { createObjectStore } from "@kudos/storage";
import { deleteExpiredRateLimits, deleteExpiredSessions, deleteExpiredVideos } from "./sessions";
import { resetDb } from "../../vitest.setup";

const sample = readFileSync(join(process.cwd(), "../../fixtures/sample-apartment-4b.json"));

describe("retention", () => {
  it("marks raw data deleted without writing upload bytes to object storage", async () => {
    await resetDb();
    const create = await createSession(
      new NextRequest("http://localhost:3000/api/sessions", {
        method: "POST",
        headers: { Origin: "http://localhost:3000", Host: "localhost:3000" },
      }),
    );
    const { sessionId } = (await create.json()) as { sessionId: string };
    const cookie = `kudos_sid=${create.cookies.get("kudos_sid")?.value}`;
    await upload(
      new NextRequest(`http://localhost:3000/api/sessions/${sessionId}/upload`, {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: "http://localhost:3000",
          Host: "localhost:3000",
          "content-type": "application/json",
        },
        body: sample,
      }),
      { params: Promise.resolve({ id: sessionId }) },
    );
    const row = await getDb().query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
    expect(row?.rawDeletedAt).toBeTruthy();
  });

  it("deletes expired sessions", async () => {
    await resetDb();
    const db = getDb();
    const [row] = await db
      .insert(sessions)
      .values({
        slug: "expiredslug123456",
        ownerTokenHash: "hash",
        expiresAt: new Date(Date.now() - 86_400_000),
      })
      .returning();
    expect(row).toBeTruthy();
    const removed = await deleteExpiredSessions(new Date());
    expect(removed).toBeGreaterThan(0);
  });

  it("drops an expired mp4 and leaves awards in place", async () => {
    await resetDb();
    const db = getDb();
    const [session] = await db
      .insert(sessions)
      .values({
        slug: "videottlslug12345",
        ownerTokenHash: "hash",
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .returning();
    if (!session) throw new Error("session missing");
    const [member] = await db
      .insert(members)
      .values({ sessionId: session.id, exportKey: "alex", displayName: "Alex", messageCount: 10 })
      .returning();
    if (!member) throw new Error("member missing");
    const [analysis] = await db
      .insert(analyses)
      .values({ sessionId: session.id, featureVersion: "1", jevModel: "jev-1.13.0", inputTokens: 1 })
      .returning();
    if (!analysis) throw new Error("analysis missing");
    await db.insert(awards).values({
      analysisId: analysis.id,
      awardId: "most_messages",
      title: "The Human Notification",
      winnerMemberId: member.id,
      source: "code",
      receipts: ["10 messages"],
      presentationLine: "Always online.",
    });
    const key = `sessions/${session.id}/final.mp4`;
    const store = createObjectStore();
    await store.put(key, Buffer.from("mp4"));
    await db.insert(ceremonies).values({
      sessionId: session.id,
      status: "complete",
      videoObjectKey: key,
      fallbackUsed: true,
      completedAt: new Date(Date.now() - 8 * 86_400_000),
      videoExpiresAt: new Date(Date.now() - 86_400_000),
    });

    const removed = await deleteExpiredVideos(new Date());
    expect(removed).toBe(1);
    expect(await store.get(key)).toBeNull();
    const still = await db.query.sessions.findFirst({ where: eq(sessions.id, session.id) });
    expect(still).toBeTruthy();
    const awardRows = await db.query.awards.findMany({ where: eq(awards.analysisId, analysis.id) });
    expect(awardRows).toHaveLength(1);
    const ceremony = await db.query.ceremonies.findFirst({ where: eq(ceremonies.sessionId, session.id) });
    expect(ceremony?.videoObjectKey).toBeNull();
  });

  it("deletes rate limit buckets older than 90 days", async () => {
    await resetDb();
    const db = getDb();
    await db.insert(rateLimitBuckets).values({
      bucket: "upload",
      ipHash: "abc",
      windowStart: new Date(Date.now() - 100 * 86_400_000),
      count: 1,
    });
    const removed = await deleteExpiredRateLimits(new Date());
    expect(removed).toBe(1);
  });
});
