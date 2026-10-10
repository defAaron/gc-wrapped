import { eq, type InferSelectModel } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { analyzeChat, type AwardResult, type FeatureStore } from "@kudos/awards";
import { getDb } from "@/src/db";
import { analyses, awards, members, sessions } from "@/src/db/schema";
import { getJevClient } from "@/src/jev/provider";
import { getOwnedSession } from "@/src/session/auth";
import { applyMemberState } from "@/src/session/feature-store";
import { jsonError } from "@/src/security/errors";
import { assertSameOrigin } from "@/src/security/origin";
import { logEvent } from "@/src/security/log";
import type { RoastLevel } from "@kudos/shared";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("UNAUTHORIZED", 403);
  const { id } = await context.params;
  const session = await getOwnedSession(request, id);
  if (!session) return jsonError("NOT_FOUND", 404);
  if (!session.consentAt) return jsonError("CONSENT_REQUIRED", 400);

  const body = (await request.json().catch(() => ({}))) as { regenerate?: boolean };
  const db = getDb();
  const existing = await db.query.analyses.findFirst({ where: eq(analyses.sessionId, id) });
  if (existing && !body.regenerate) {
    await db.update(sessions).set({ status: "preview" }).where(eq(sessions.id, id));
    return NextResponse.json({ status: "preview", analysisId: existing.id });
  }
  if (body.regenerate) {
    if (session.regenerateCount >= 2) return jsonError("RATE_LIMITED", 429);
    await db
      .update(sessions)
      .set({ regenerateCount: session.regenerateCount + 1 })
      .where(eq(sessions.id, id));
  }

  const memberRows: InferSelectModel<typeof members>[] = await db.query.members.findMany({
    where: eq(members.sessionId, id),
  });
  const active = memberRows.filter((row) => !row.excluded);
  if (active.length < 2) return jsonError("INVALID_INPUT", 400);

  const baseStore = session.featureStoreJson as FeatureStore | null;
  if (!baseStore) return jsonError("INVALID_INPUT", 400);
  const store = applyMemberState(baseStore, memberRows);
  await db.update(sessions).set({ status: "analyzing" }).where(eq(sessions.id, id));

  const result = await analyzeChat({
    store,
    roastLevel: session.roastLevel as RoastLevel,
    jev: getJevClient(),
  });

  const exportToMember = new Map(memberRows.map((row) => [row.exportKey, row]));
  if (existing) {
    await db.delete(awards).where(eq(awards.analysisId, existing.id));
    await db.delete(analyses).where(eq(analyses.id, existing.id));
  }

  const [analysis] = await db
    .insert(analyses)
    .values({
      sessionId: id,
      featureVersion: store.featureVersion,
      jevModel: result.jevModel,
      inputTokens: result.inputTokens,
    })
    .returning();

  if (!analysis) return jsonError("INVALID_INPUT", 500);

  await persistAwards(analysis.id, result.awards, exportToMember);
  await db.update(sessions).set({ status: "preview" }).where(eq(sessions.id, id));
  logEvent("session_analyzed", { sessionId: id, awardCount: result.awards.length });
  return NextResponse.json({ status: "preview", analysisId: analysis.id });
}

async function persistAwards(
  analysisId: string,
  awardResults: AwardResult[],
  exportToMember: Map<string, { id: string }>,
) {
  const db = getDb();
  for (const award of awardResults) {
    const winner = exportToMember.get(award.winnerMemberId);
    if (!winner) continue;
    const runner = award.runnerUpMemberId ? exportToMember.get(award.runnerUpMemberId) : undefined;
    await db.insert(awards).values({
      analysisId,
      awardId: award.awardId,
      title: award.title,
      winnerMemberId: winner.id,
      runnerUpMemberId: runner?.id,
      source: award.source,
      receipts: award.receipts,
      presentationLine: award.presentationLine,
      exemplarQuote: award.exemplarQuote ?? null,
      jevConfidence: award.jev?.confidence ?? null,
      jevQuestionId: award.jev?.questionId ?? null,
    });
  }
}
