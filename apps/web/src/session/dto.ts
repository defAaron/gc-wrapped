import { desc, eq, type InferSelectModel } from "drizzle-orm";
import { getDb } from "../db";
import { analyses, awards, members } from "../db/schema";

type MemberRow = InferSelectModel<typeof members>;
type AwardRow = InferSelectModel<typeof awards>;

export async function buildOwnerSessionDto(sessionId: string, session: {
  status: string;
  roastLevel: string;
  groupTitle: string | null;
  slug: string;
}) {
  const db = getDb();
  const memberRows = await db.query.members.findMany({ where: eq(members.sessionId, sessionId) });
  const analysisRows = await db
    .select()
    .from(analyses)
    .where(eq(analyses.sessionId, sessionId))
    .orderBy(desc(analyses.completedAt))
    .limit(1);
  const analysis = analysisRows[0];
  let awardRows: AwardRow[] = [];
  if (analysis) {
    awardRows = await db.query.awards.findMany({ where: eq(awards.analysisId, analysis.id) });
  }
  const memberById = new Map(memberRows.map((row) => [row.id, row]));
  const exportById = new Map(memberRows.map((row) => [row.exportKey, row]));

  return {
    status: session.status,
    roastLevel: session.roastLevel,
    groupTitle: session.groupTitle,
    slug: session.slug,
    members: memberRows.map((row) => ({
      id: row.id,
      exportKey: row.exportKey,
      displayName: row.displayName,
      messageCount: row.messageCount,
      excluded: row.excluded,
    })),
    analysis: analysis
      ? {
          awards: awardRows.map((row) => {
            const winner = memberById.get(row.winnerMemberId);
            const runner = row.runnerUpMemberId ? memberById.get(row.runnerUpMemberId) : undefined;
            return {
              awardId: row.awardId,
              title: row.title,
              winner: {
                memberId: winner?.id ?? row.winnerMemberId,
                displayName: winner?.displayName ?? "Unknown",
              },
              runnerUp: runner
                ? { memberId: runner.id, displayName: runner.displayName }
                : undefined,
              presentationLine: row.presentationLine,
              receipts: row.receipts,
              source: row.source,
              exemplarQuote: row.exemplarQuote ?? undefined,
            };
          }),
        }
      : null,
    ceremony: null,
    _exportById: exportById,
  };
}

export function stripInternal<T extends { _exportById?: unknown }>(dto: T): Omit<T, "_exportById"> {
  const { _exportById: _ignored, ...rest } = dto;
  return rest;
}

export type MemberLookup = Map<string, MemberRow>;
