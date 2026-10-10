import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/src/db";
import { sessions } from "@/src/db/schema";
import { getOwnedSession } from "@/src/session/auth";
import { jsonError } from "@/src/security/errors";
import { assertSameOrigin } from "@/src/security/origin";
import { logEvent } from "@/src/security/log";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("UNAUTHORIZED", 403);
  const { id } = await context.params;
  const session = await getOwnedSession(request, id);
  if (!session) return jsonError("NOT_FOUND", 404);
  if (!session.consentAt) return jsonError("CONSENT_REQUIRED", 400);
  if (session.status !== "preview" && session.status !== "complete") {
    return jsonError("INVALID_INPUT", 400);
  }
  const db = getDb();
  await db.update(sessions).set({ status: "preview" }).where(eq(sessions.id, id));
  logEvent("session_published", { sessionId: id, slug: session.slug });
  return NextResponse.json({ shareUrl: `/s/${session.slug}`, slug: session.slug });
}
