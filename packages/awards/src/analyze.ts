import type { RoastLevel } from "@kudos/shared";
import { AWARD_TITLES, type AwardId } from "./catalog";
import { exemplarsAreOnlyCrisis, isBlocked } from "./copy/blocklist";
import { renderPresentationLine } from "./copy/render";
import { assignDeterministicAwards } from "./deterministic";
import type { FeatureStore, MemberFeatures } from "./features/types";
import { JevMaxTokensError, JEV_MODEL, type JevAnswer, type JevClient } from "./jev/client";
import { buildQuestions, buildShortlists, memeTie, type Shortlists } from "./jev/questions";
import { buildJevState } from "./jev/state";

export type AwardResult = {
  awardId: AwardId;
  title: string;
  winnerMemberId: string;
  runnerUpMemberId?: string;
  source: "code" | "jev";
  receipts: string[];
  presentationLine: string;
  exemplarQuote?: string;
  jev?: { questionId: string; confidence?: number };
};

type WorkingAward = AwardResult & { margin: number; category: keyof MemberFeatures["exemplars"] | null };

const SUBJECTIVE: { questionId: string; awardId: AwardId; category: keyof MemberFeatures["exemplars"] }[] = [
  { questionId: "funniest_winner", awardId: "funniest", category: "funny" },
  { questionId: "drama_starter_winner", awardId: "drama_starter", category: "drama" },
  { questionId: "peacemaker_winner", awardId: "peacemaker", category: "wholesome" },
  { questionId: "planner_winner", awardId: "planner", category: "links" },
  { questionId: "chaos_gremlin", awardId: "chaos_gremlin", category: "drama" },
  { questionId: "heart_of_group", awardId: "heart_of_group", category: "wholesome" },
];

const CATEGORY_BY_AWARD: Partial<Record<AwardId, keyof MemberFeatures["exemplars"]>> = {
  most_messages: "funny",
  least_messages: "wholesome",
  late_night_texter: "lateNight",
  early_bird: "wholesome",
  link_lord: "links",
  double_texter: "funny",
  caps_champion: "drama",
  emoji_overload: "funny",
  meme_dealer: "links",
  hype_person: "wholesome",
  funniest: "funny",
  drama_starter: "drama",
  peacemaker: "wholesome",
  planner: "links",
  chaos_gremlin: "drama",
  heart_of_group: "wholesome",
};

function memberById(store: FeatureStore, id: string): MemberFeatures | undefined {
  return store.members.find((member) => member.memberId === id);
}

function leader(store: FeatureStore, metric: (member: MemberFeatures) => number): MemberFeatures | undefined {
  return [...store.members].sort((left, right) => {
    const delta = metric(right) - metric(left);
    if (delta !== 0) return delta;
    if (left.wordCount !== right.wordCount) return right.wordCount - left.wordCount;
    if (left.memberId < right.memberId) return -1;
    if (left.memberId > right.memberId) return 1;
    return 0;
  })[0];
}

function runnerUp(ids: string[], winnerId: string): string | undefined {
  return ids.find((id) => id !== winnerId);
}

function counts(awards: WorkingAward[]): Map<string, number> {
  const tally = new Map<string, number>();
  for (const award of awards) tally.set(award.winnerMemberId, (tally.get(award.winnerMemberId) ?? 0) + 1);
  return tally;
}

function reassign(award: WorkingAward, nextWinner: string): void {
  const previous = award.winnerMemberId;
  award.winnerMemberId = nextWinner;
  award.runnerUpMemberId = previous;
}

function applyFairness(awards: WorkingAward[]): WorkingAward[] {
  for (let guard = 0; guard < awards.length * 4; guard += 1) {
    const tally = counts(awards);
    const overloaded = [...tally.entries()].filter(([, count]) => count > 4).map(([id]) => id);
    if (overloaded.length === 0) return awards;

    const jevAward = awards
      .filter(
        (award) =>
          award.source === "jev" && overloaded.includes(award.winnerMemberId) && award.runnerUpMemberId !== undefined,
      )
      .sort((left, right) => (left.jev?.confidence ?? 0) - (right.jev?.confidence ?? 0))
      .find((award) => (tally.get(award.runnerUpMemberId ?? "") ?? 0) < 4);
    if (jevAward?.runnerUpMemberId) {
      reassign(jevAward, jevAward.runnerUpMemberId);
      continue;
    }

    const codeAward = awards
      .filter(
        (award) =>
          award.source === "code" && overloaded.includes(award.winnerMemberId) && award.runnerUpMemberId !== undefined,
      )
      .sort((left, right) => left.margin - right.margin)
      .find((award) => (tally.get(award.runnerUpMemberId ?? "") ?? 0) < 4);
    if (codeAward?.runnerUpMemberId) {
      reassign(codeAward, codeAward.runnerUpMemberId);
      continue;
    }
    return awards;
  }
  return awards;
}

function finish(store: FeatureStore, roastLevel: RoastLevel, awards: WorkingAward[]): AwardResult[] {
  return awards.map((award) => {
    const winner = memberById(store, award.winnerMemberId);
    const samples = award.category && winner ? winner.exemplars[award.category] : [];
    const blockedSample = samples.some((sample) => isBlocked(sample));
    const quote = samples.find((sample) => sample.trim() && !isBlocked(sample));
    const presentationLine = renderPresentationLine({
      awardId: award.awardId,
      winnerMemberId: award.winnerMemberId,
      displayName: winner?.displayName ?? award.winnerMemberId,
      roastLevel,
      forceGentle: roastLevel === "spicy" && blockedSample,
    });
    const result: AwardResult = {
      awardId: award.awardId,
      title: award.title,
      winnerMemberId: award.winnerMemberId,
      source: award.source,
      receipts: award.receipts,
      presentationLine,
    };
    if (award.runnerUpMemberId !== undefined) result.runnerUpMemberId = award.runnerUpMemberId;
    if (quote) result.exemplarQuote = quote;
    if (award.jev) result.jev = award.jev;
    return result;
  });
}

async function decide(jev: JevClient, store: FeatureStore, roastLevel: RoastLevel, questions: Record<string, unknown>) {
  const firstState = buildJevState(store, roastLevel);
  try {
    return await jev.decide({ model: JEV_MODEL, state: firstState, questions });
  } catch (error) {
    if (!(error instanceof JevMaxTokensError)) throw error;
    const compact = buildJevState(store, roastLevel, { includeExemplars: false });
    return jev.decide({ model: JEV_MODEL, state: compact, questions });
  }
}

function codeAwards(store: FeatureStore): WorkingAward[] {
  return assignDeterministicAwards(store).map((award) => ({
    awardId: award.awardId,
    title: award.title,
    winnerMemberId: award.winnerMemberId,
    ...(award.runnerUpMemberId ? { runnerUpMemberId: award.runnerUpMemberId } : {}),
    source: "code" as const,
    receipts: award.receipts,
    presentationLine: "",
    margin: award.margin,
    category: CATEGORY_BY_AWARD[award.awardId] ?? null,
  }));
}

function subjectiveAward(
  store: FeatureStore,
  shortlists: Shortlists,
  awardId: AwardId,
  questionId: string,
  category: keyof MemberFeatures["exemplars"],
  answer: JevAnswer | undefined,
  fallbackId?: string,
): WorkingAward | null {
  const listKey = awardId === "chaos_gremlin" ? "chaos_gremlin" : awardId === "heart_of_group" ? "heart_of_group" : awardId;
  const shortlist = shortlists[listKey as keyof Shortlists] ?? [];
  const samples = (id: string) => memberById(store, id)?.exemplars[category] ?? [];
  const choice = answer?.choice;
  const chosen =
    choice && shortlist.includes(choice) ? choice : fallbackId && shortlist.includes(fallbackId) ? fallbackId : undefined;
  if (!chosen) return null;
  if (exemplarsAreOnlyCrisis(samples(chosen))) return null;
  const usedFallback = Boolean(fallbackId && chosen === fallbackId && choice !== chosen);
  const award: WorkingAward = {
    awardId,
    title: AWARD_TITLES[awardId],
    winnerMemberId: chosen,
    source: usedFallback ? "code" : "jev",
    receipts: ["judged from the shortlist"],
    presentationLine: "",
    margin: 1 - (answer?.confidence ?? 0),
    category,
  };
  const next = runnerUp(shortlist, chosen);
  if (next) award.runnerUpMemberId = next;
  if (award.source === "jev") {
    award.jev = { questionId };
    if (answer?.confidence !== undefined) award.jev.confidence = answer.confidence;
  }
  return award;
}

export async function analyzeChat(input: {
  store: FeatureStore;
  roastLevel: RoastLevel;
  jev: JevClient;
}): Promise<{ awards: AwardResult[]; inputTokens: number; jevModel: "jev-1.13.0" }> {
  const shortlists = buildShortlists(input.store);
  const questions = buildQuestions(input.store, shortlists);
  const decision = await decide(input.jev, input.store, input.roastLevel, questions);
  const answers = decision.answers;

  let awards = codeAwards(input.store);
  if (memeTie(input.store.members)) {
    awards = awards.filter((award) => award.awardId !== "meme_dealer");
    const meme = subjectiveAward(
      input.store,
      shortlists,
      "meme_dealer",
      "meme_dealer_winner",
      "links",
      answers.meme_dealer_winner,
    );
    if (meme) awards.push(meme);
    else {
      const codeMeme = codeAwards(input.store).find((award) => award.awardId === "meme_dealer");
      if (codeMeme) awards.push(codeMeme);
    }
  }

  for (const subjective of SUBJECTIVE) {
    const answer = answers[subjective.questionId];
    const funnyLeader = leader(input.store, (member) => member.laughProxy);
    if (subjective.awardId === "funniest") {
      const noul = answers.funniest_confidence_gate?.noul;
      if (noul !== undefined && noul < 0.55 && funnyLeader) {
        const fallback = subjectiveAward(
          input.store,
          shortlists,
          "funniest",
          "funniest_winner",
          "funny",
          undefined,
          funnyLeader.memberId,
        );
        if (fallback) awards.push(fallback);
        continue;
      }
    }
    const created = subjectiveAward(
      input.store,
      shortlists,
      subjective.awardId,
      subjective.questionId,
      subjective.category,
      answer,
    );
    if (created) awards.push(created);
  }

  const fair = applyFairness(awards);
  return {
    awards: finish(input.store, input.roastLevel, fair),
    inputTokens: decision.usage.input_tokens,
    jevModel: JEV_MODEL,
  };
}
