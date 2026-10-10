import type { FeatureStore, MemberFeatures } from "../features/types";

export type Shortlists = {
  funniest: string[];
  drama_starter: string[];
  peacemaker: string[];
  planner: string[];
  chaos_gremlin: string[];
  heart_of_group: string[];
  meme_dealer: string[];
};

function rank(members: MemberFeatures[], metric: (member: MemberFeatures) => number): MemberFeatures[] {
  return [...members].sort((left, right) => {
    const delta = metric(right) - metric(left);
    if (delta !== 0) return delta;
    if (left.wordCount !== right.wordCount) return right.wordCount - left.wordCount;
    if (left.memberId < right.memberId) return -1;
    if (left.memberId > right.memberId) return 1;
    return 0;
  });
}

function top(members: MemberFeatures[], metric: (member: MemberFeatures) => number): string[] {
  const ranked = rank(members, metric);
  const pool = members.length < 3 ? ranked : ranked.slice(0, 3);
  return pool.map((member) => member.memberId);
}

export function memeTie(members: MemberFeatures[]): boolean {
  const ranked = rank(members, (member) => member.mediaCount);
  const first = ranked[0];
  const second = ranked[1];
  if (!first || !second) return false;
  return first.mediaCount > 0 && first.mediaCount === second.mediaCount;
}

export function buildShortlists(store: FeatureStore): Shortlists {
  const heart = (member: MemberFeatures) =>
    new Set(store.replyEdges.filter((edge) => edge.fromId === member.memberId).map((edge) => edge.toId)).size;
  return {
    funniest: top(store.members, (member) => member.laughProxy),
    drama_starter: top(store.members, (member) => member.dramaProxy),
    peacemaker: top(store.members, (member) => member.exemplars.wholesome.length),
    planner: top(store.members, (member) => member.linkCount),
    chaos_gremlin: top(store.members, (member) => member.dramaProxy + member.doubleTextScore),
    heart_of_group: top(store.members, heart),
    meme_dealer: memeCandidates(store.members),
  };
}

function memeCandidates(members: MemberFeatures[]): string[] {
  if (!memeTie(members)) return [];
  const ranked = rank(members, (member) => member.mediaCount);
  const best = ranked[0]?.mediaCount ?? 0;
  return ranked.filter((member) => member.mediaCount === best).map((member) => member.memberId);
}

function criteria(store: FeatureStore, ids: string[], detail: (member: MemberFeatures) => string): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const id of ids) {
    const member = store.members.find((candidate) => candidate.memberId === id);
    if (!member) continue;
    mapped[id] = `${member.displayName} — ${detail(member)}`;
  }
  return mapped;
}

export function buildQuestions(store: FeatureStore, shortlists: Shortlists): Record<string, unknown> {
  const questions: Record<string, unknown> = {};
  const addChoice = (id: string, instructions: string, ids: string[], detail: (member: MemberFeatures) => string) => {
    if (ids.length === 0) return;
    questions[id] = { type: "choice", instructions, criteria: criteria(store, ids, detail) };
  };

  addChoice(
    "funniest_winner",
    "Who is funniest in a friendly roast sense, based on exemplars and laugh_proxy stats? Pick exactly one member id.",
    shortlists.funniest,
    (member) => `laugh_proxy ${member.laughProxy}`,
  );
  if (shortlists.funniest.length > 0) {
    questions.funniest_confidence_gate = {
      type: "noul",
      instructions: "Is there a clear funniest winner (not a 3-way tie in quality)?",
    };
  }
  addChoice(
    "drama_starter_winner",
    "Who most often escalates or starts conflict threads (playful roast, not moral judgment)?",
    shortlists.drama_starter,
    (member) => `drama_proxy ${member.dramaProxy}`,
  );
  addChoice(
    "peacemaker_winner",
    "Who de-escalates, changes subject constructively, or supports others?",
    shortlists.peacemaker,
    (member) => `wholesome exemplars ${member.exemplars.wholesome.length}`,
  );
  addChoice(
    "planner_winner",
    "Who organizes meetups, polls, logistics?",
    shortlists.planner,
    (member) => `link_count ${member.linkCount}`,
  );
  addChoice(
    "chaos_gremlin",
    "Who introduces random tangents and unpredictable energy?",
    shortlists.chaos_gremlin,
    (member) => `drama_proxy ${member.dramaProxy}`,
  );
  addChoice(
    "heart_of_group",
    "Who keeps the most members engaged (replies across cliques)?",
    shortlists.heart_of_group,
    (member) => `reply targets ${store.replyEdges.filter((edge) => edge.fromId === member.memberId).length}`,
  );
  addChoice(
    "meme_dealer_winner",
    "If stats are ambiguous, who supplies memes/images that match group humor?",
    shortlists.meme_dealer,
    (member) => `media_count ${member.mediaCount}`,
  );
  return questions;
}
