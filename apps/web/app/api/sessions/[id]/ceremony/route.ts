import { and, eq, inArray } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { ACTIVE_CEREMONY_STATUSES } from "@kudos/shared";
import { enqueueCeremony } from "@kudos/worker/queue";
import { getDb } from "@/src/db";
import { analyses, ceremonies, sessions } from "@/src/db/schema";
import { getOwnedSession } from "@/src/session/auth";
import { jsonError } from "@/src/security/errors";
import { assertSameOrigin } from "@/src/security/origin";
import { checkRateLimit } from "@/src/security/rate-limit";
import { logEvent } from "@/src/security/log";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("UNAUTHORIZED", 403);
  const { id } = await context.params;
  const session = await getOwnedSession(request, id);
  if (!session) return jsonError("NOT_FOUND", 404);
  if (!session.consentAt) return jsonError("CONSENT_REQUIRED", 400);

  const limit = await checkRateLimit(request, "ceremony", 3, DAY_MS);
  if (!limit.allowed) return jsonError("RATE_LIMITED", 429);

  const db = getDb();
  const analysis = await db.query.analyses.findFirst({ where: eq(analyses.sessionId, id) });
  if (!analysis) return jsonError("INVALID_INPUT", 400);

  const active = await db.query.ceremonies.findFirst({
    where: and(eq(ceremonies.sessionId, id), inArray(ceremonies.status, ACTIVE_CEREMONY_STATUSES)),
  });
  if (active) {
    return NextResponse.json({ ceremonyId: active.id, status: "rendering" }, { status: 202 });
  }

  const [ceremony] = await db
    .insert(ceremonies)
    .values({ sessionId: id, status: "pending" })
    .returning();
  if (!ceremony) return jsonError("INVALID_INPUT", 500);

  await db.update(sessions).set({ status: "rendering" }).where(eq(sessions.id, id));
  await enqueueCeremony(ceremony.id);
  logEvent("ceremony_started", { sessionId: id, ceremonyId: ceremony.id });
  return NextResponse.json({ ceremonyId: ceremony.id, status: "rendering" }, { status: 202 });
}
