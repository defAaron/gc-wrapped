import { desc, eq, type InferSelectModel } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/src/db";
import { analyses, awards, ceremonies, members, sessions } from "@/src/db/schema";
import { jsonError } from "@/src/security/errors";

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const db = getDb();
  const session = await db.query.sessions.findFirst({ where: eq(sessions.slug, slug) });
  if (!session) return jsonError("NOT_FOUND", 404);

  const memberRows: InferSelectModel<typeof members>[] = await db.query.members.findMany({
    where: eq(members.sessionId, session.id),
  });
  const analysis = await db.query.analyses.findFirst({ where: eq(analyses.sessionId, session.id) });
  if (!analysis) return jsonError("NOT_FOUND", 404);
  const awardRows = await db.query.awards.findMany({ where: eq(awards.analysisId, analysis.id) });
  const memberById = new Map(memberRows.map((row) => [row.id, row]));

  const ceremonyRows = await db
    .select()
    .from(ceremonies)
    .where(eq(ceremonies.sessionId, session.id))
    .orderBy(desc(ceremonies.createdAt))
    .limit(1);
  const ceremony = ceremonyRows[0];

  const payload = {
    groupTitle: session.groupTitle,
    watermark: "Kudos AI",
    videoUrl: ceremony?.status === "complete" ? `/api/s/${slug}/video` : null,
    awards: awardRows.map((row) => {
      const winner = memberById.get(row.winnerMemberId);
      const award = {
        awardId: row.awardId,
        title: row.title,
        winner: { memberId: winner?.id ?? row.winnerMemberId, displayName: winner?.displayName ?? "Unknown" },
        presentationLine: row.presentationLine,
        receipts: row.receipts,
        source: row.source,
      };
      if (session.quotesPublic && row.exemplarQuote) {
        return { ...award, exemplarQuote: row.exemplarQuote };
      }
      return award;
    }),
  };

  const json = JSON.stringify(payload);
  if (!session.quotesPublic && json.includes('"exemplarQuote"')) {
    return jsonError("INVALID_INPUT", 500);
  }
  if (json.includes('"messages"') || json.includes('"text"')) {
    return jsonError("INVALID_INPUT", 500);
  }
  return NextResponse.json(payload);
}
