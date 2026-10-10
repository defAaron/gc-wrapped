import { eq, type InferSelectModel } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/src/db";
import { analyses, awards, members, sessions } from "@/src/db/schema";
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

  const payload = {
    groupTitle: session.groupTitle,
    watermark: "Kudos AI",
    videoUrl: null,
    awards: awardRows.map((row) => {
      const winner = memberById.get(row.winnerMemberId);
      return {
        awardId: row.awardId,
        title: row.title,
        winner: { memberId: winner?.id ?? row.winnerMemberId, displayName: winner?.displayName ?? "Unknown" },
        presentationLine: row.presentationLine,
        receipts: row.receipts,
        source: row.source,
      };
    }),
  };

  const forbidden = ["exemplarQuote", "text", "messages"];
  const json = JSON.stringify(payload);
  if (forbidden.some((key) => json.includes(`"${key}"`))) {
    return jsonError("INVALID_INPUT", 500);
  }
  return NextResponse.json(payload);
}
