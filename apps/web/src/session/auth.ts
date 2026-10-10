import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "../db";
import { sessions } from "../db/schema";
import { hashToken, readOwnerToken } from "../security/session-cookie";

export async function getOwnedSession(request: NextRequest, sessionId: string) {
  const token = readOwnerToken(request);
  if (!token) return null;
  const db = getDb();
  const row = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
  if (!row) return null;
  if (row.ownerTokenHash !== hashToken(token)) return null;
  return row;
}
