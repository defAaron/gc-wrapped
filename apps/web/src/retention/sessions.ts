import { eq, lt } from "drizzle-orm";
import { getDb } from "../db";
import { sessions } from "../db/schema";
import { createLocalObjectStore } from "../storage/local-disk";

export async function deleteExpiredSessions(now = new Date()): Promise<number> {
  const db = getDb();
  const store = createLocalObjectStore();
  const expired = await db.select().from(sessions).where(lt(sessions.expiresAt, now));
  for (const row of expired) {
    await store.deletePrefix(`sessions/${row.id}`);
    await db.delete(sessions).where(eq(sessions.id, row.id));
  }
  return expired.length;
}

export async function deleteSessionArtifacts(sessionId: string): Promise<void> {
  const db = getDb();
  const store = createLocalObjectStore();
  await store.deletePrefix(`sessions/${sessionId}`);
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}
