import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/src/db";
import { sessions, shareReports } from "@/src/db/schema";
import { jsonError } from "@/src/security/errors";
import { assertSameOrigin } from "@/src/security/origin";
import { checkRateLimit } from "@/src/security/rate-limit";

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("UNAUTHORIZED", 403);
  const limited = await checkRateLimit(request, "share_report", 5, 60 * 60 * 1000);
  if (!limited.allowed) return jsonError("RATE_LIMITED", 429);

  const { slug } = await context.params;
  const db = getDb();
  const session = await db.query.sessions.findFirst({ where: eq(sessions.slug, slug) });
  if (!session) return jsonError("NOT_FOUND", 404);

  const body = (await request.json()) as { reason?: string };
  const reason = (body.reason ?? "").trim();
  if (!reason || reason.length > 500) return jsonError("INVALID_INPUT", 400);

  await db.insert(shareReports).values({ slug, reason });
  return NextResponse.json({ ok: true });
}
