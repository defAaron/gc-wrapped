import { RATE_LIMIT_TTL_MS } from "@kudos/shared";
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { getDb } from "../db";
import { ceremonies, rateLimitBuckets, sessions } from "../db/schema";
import { createObjectStore } from "@kudos/storage";

export async function deleteExpiredSessions(now = new Date()): Promise<number> {
  const db = getDb();
  const store = createObjectStore();
  const expired = await db.select().from(sessions).where(lt(sessions.expiresAt, now));
  for (const row of expired) {
    await store.deletePrefix(`sessions/${row.id}`);
    await db.delete(sessions).where(eq(sessions.id, row.id));
  }
  return expired.length;
}

export async function deleteSessionArtifacts(sessionId: string): Promise<void> {
  const db = getDb();
  const store = createObjectStore();
  await store.deletePrefix(`sessions/${sessionId}`);
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function deleteExpiredVideos(now = new Date()): Promise<number> {
  const db = getDb();
  const store = createObjectStore();
  const expired = await db
    .select()
    .from(ceremonies)
    .where(and(isNotNull(ceremonies.videoExpiresAt), lt(ceremonies.videoExpiresAt, now), isNotNull(ceremonies.videoObjectKey)));
  for (const row of expired) {
    if (row.videoObjectKey) await store.delete(row.videoObjectKey);
    await db.update(ceremonies).set({ videoObjectKey: null }).where(eq(ceremonies.id, row.id));
  }
  return expired.length;
}

export async function deleteExpiredRateLimits(now = new Date()): Promise<number> {
  const db = getDb();
  const cutoff = new Date(now.getTime() - RATE_LIMIT_TTL_MS);
  const removed = await db.delete(rateLimitBuckets).where(lt(rateLimitBuckets.windowStart, cutoff)).returning();
  return removed.length;
}

export async function runRetentionSweeps(now = new Date()): Promise<{
  sessionsRemoved: number;
  videosRemoved: number;
  rateLimitsRemoved: number;
}> {
  const videosRemoved = await deleteExpiredVideos(now);
  const sessionsRemoved = await deleteExpiredSessions(now);
  const rateLimitsRemoved = await deleteExpiredRateLimits(now);
  return { sessionsRemoved, videosRemoved, rateLimitsRemoved };
}
