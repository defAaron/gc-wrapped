import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/src/db";
import { sessions } from "@/src/db/schema";
import { logEvent } from "@/src/security/log";
import { jsonError } from "@/src/security/errors";
import { assertSameOrigin } from "@/src/security/origin";
import { checkRateLimit } from "@/src/security/rate-limit";
import { newOwnerToken, setOwnerCookie } from "@/src/security/session-cookie";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("UNAUTHORIZED", 403);
  const limited = await checkRateLimit(request, "session_create", 30, 60 * 60 * 1000);
  if (!limited.allowed) return jsonError("RATE_LIMITED", 429);

  const { token, hash } = newOwnerToken();
  const slug = randomBytes(16).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const db = getDb();
  const [row] = await db
    .insert(sessions)
    .values({ slug, ownerTokenHash: hash, expiresAt })
    .returning({ id: sessions.id });

  if (!row) return jsonError("INVALID_INPUT", 500);
  logEvent("session_created", { sessionId: row.id });
  const response = NextResponse.json({
    sessionId: row.id,
    uploadUrl: `/api/sessions/${row.id}/upload`,
  });
  setOwnerCookie(response, token);
  return response;
}
