import type { AwardId, AwardResult } from "@kudos/awards";
import type { RoastLevel } from "@kudos/shared";

export const HEADLINE_AWARD_ORDER: AwardId[] = [
  "most_messages",
  "funniest",
  "least_messages",
  "late_night_texter",
  "drama_starter",
  "heart_of_group",
];

export type ScriptLine = { id: string; text: string; memberId?: string; awardId?: AwardId };

export function buildScript(input: {
  groupTitle: string;
  roastLevel: RoastLevel;
  awards: AwardResult[];
  members: { id: string; displayName: string }[];
}): { lines: ScriptLine[]; headlineAwardIds: AwardId[] } {
  const memberName = new Map(input.members.map((m) => [m.id, m.displayName]));
  const byAward = new Map(input.awards.map((a) => [a.awardId, a]));

  const headlineAwardIds: AwardId[] = [];
  for (const awardId of HEADLINE_AWARD_ORDER) {
    if (byAward.has(awardId)) headlineAwardIds.push(awardId);
  }

  const lines: ScriptLine[] = [];
  const title = input.groupTitle.trim() || "your group chat";
  lines.push({
    id: "intro",
    text: `Welcome to the ${title} Kudos awards. Let's hand out some trophies.`,
  });

  for (const awardId of headlineAwardIds) {
    const award = byAward.get(awardId);
    if (!award) continue;
    const winnerKey = award.winnerMemberId;
    const name = memberName.get(winnerKey) ?? "someone";
    lines.push({
      id: `headline_${awardId}`,
      text: `And the award for ${award.title} goes to… ${name}! ${award.presentationLine}`,
      memberId: winnerKey,
      awardId,
    });
  }

  const headlineSet = new Set(headlineAwardIds);
  const speedRound = input.awards.filter((a) => !headlineSet.has(a.awardId));
  if (speedRound.length > 0) {
    const bits = speedRound
      .map((a) => {
        const name = memberName.get(a.winnerMemberId) ?? "someone";
        return `${a.title}: ${name}`;
      })
      .join(". ");
    lines.push({
      id: "speed_round",
      text: `Speed round kudos. ${bits}.`,
    });
  }

  lines.push({
    id: "outro",
    text: "Post this in the chat. You earned it.",
  });

  return { lines, headlineAwardIds };
}
