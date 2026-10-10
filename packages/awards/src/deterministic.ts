import { AWARD_TITLES, type AwardDraft, type AwardId } from "./catalog";
import type { FeatureStore, MemberFeatures } from "./features/types";

type Metric = (member: MemberFeatures) => number;

function isInactive(member: MemberFeatures, messageCount: number): boolean {
  return member.msgCount < 20 && member.msgCount < messageCount * 0.02;
}

function compare(left: MemberFeatures, right: MemberFeatures, metric: Metric, direction: "max" | "min"): number {
  const leftValue = metric(left);
  const rightValue = metric(right);
  if (leftValue !== rightValue) {
    return direction === "max" ? rightValue - leftValue : leftValue - rightValue;
  }
  if (left.wordCount !== right.wordCount) return right.wordCount - left.wordCount;
  if (left.memberId < right.memberId) return -1;
  if (left.memberId > right.memberId) return 1;
  return 0;
}

function pick(
  members: MemberFeatures[],
  metric: Metric,
  direction: "max" | "min",
  eligible: (member: MemberFeatures) => boolean = () => true,
): { winner: MemberFeatures; runnerUp?: MemberFeatures; margin: number } | null {
  const pool = members.filter(eligible);
  if (pool.length === 0) return null;
  const ranked = [...pool].sort((left, right) => compare(left, right, metric, direction));
  const winner = ranked[0];
  if (!winner) return null;
  const runnerUp = ranked[1];
  const margin = runnerUp ? Math.abs(metric(winner) - metric(runnerUp)) : 0;
  if (runnerUp) return { winner, runnerUp, margin };
  return { winner, margin };
}

function draft(
  awardId: AwardId,
  choice: { winner: MemberFeatures; runnerUp?: MemberFeatures; margin: number },
  receipts: string[],
): AwardDraft {
  const award: AwardDraft = {
    awardId,
    title: AWARD_TITLES[awardId],
    winnerMemberId: choice.winner.memberId,
    source: "code",
    margin: choice.margin,
    receipts,
  };
  if (choice.runnerUp) award.runnerUpMemberId = choice.runnerUp.memberId;
  return award;
}

function percent(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

export function assignDeterministicAwards(store: FeatureStore): AwardDraft[] {
  const awards: AwardDraft[] = [];
  const members = store.members;
  const active = (member: MemberFeatures) => !isInactive(member, store.messageCount);
  const hasReplyMedian = (member: MemberFeatures) =>
    member.replySampleCount >= 30 && member.medianResponseSec !== null;

  const most = pick(members, (member) => member.msgCount, "max", (member) => member.msgCount > 0);
  if (most) {
    awards.push(
      draft("most_messages", most, [
        `${most.winner.msgCount} messages (${percent(most.winner.msgCount, store.messageCount)}% of the chat)`,
      ]),
    );
  }

  const tiedMessageCounts = new Set(members.map((member) => member.msgCount)).size === 1;
  const least = pick(
    members,
    (member) => member.msgCount,
    "min",
    (member) =>
      active(member) &&
      member.msgCount > 0 &&
      !(tiedMessageCounts && most && member.memberId === most.winner.memberId),
  );
  if (least) {
    awards.push(draft("least_messages", least, [`${least.winner.msgCount} messages`]));
  }

  const fastest = pick(members, (member) => member.medianResponseSec ?? Number.POSITIVE_INFINITY, "min", hasReplyMedian);
  if (fastest && fastest.winner.medianResponseSec !== null) {
    awards.push(draft("fastest_replier", fastest, [`median reply ${Math.round(fastest.winner.medianResponseSec)}s`]));
  }

  const slowest = pick(
    members,
    (member) => member.medianResponseSec ?? 0,
    "max",
    (member) => hasReplyMedian(member) && active(member),
  );
  if (slowest && slowest.winner.medianResponseSec !== null) {
    awards.push(draft("slowest_replier", slowest, [`median reply ${Math.round(slowest.winner.medianResponseSec)}s`]));
  }

  const late = pick(members, (member) => member.lateNightShare, "max", (member) => member.lateNightShare > 0);
  if (late) {
    awards.push(draft("late_night_texter", late, [`${Math.round(late.winner.lateNightShare * 100)}% of messages after midnight`]));
  }

  const early = pick(members, (member) => member.earlyBirdShare, "max", (member) => member.earlyBirdShare > 0);
  if (early) {
    awards.push(draft("early_bird", early, [`${Math.round(early.winner.earlyBirdShare * 100)}% of messages before 9`]));
  }

  const groupLinks = members.reduce((sum, member) => sum + member.linkCount, 0);
  if (groupLinks >= 10) {
    const links = pick(members, (member) => member.linkCount, "max", (member) => member.linkCount > 0);
    if (links) awards.push(draft("link_lord", links, [`${links.winner.linkCount} links`]));
  }

  const doubles = pick(members, (member) => member.doubleTextScore, "max", (member) => member.doubleTextScore > 0);
  if (doubles) awards.push(draft("double_texter", doubles, [`${doubles.winner.doubleTextScore} quick follow-ups`]));

  const caps = pick(members, (member) => member.capsLockRate, "max", (member) => member.capsLockRate > 0);
  if (caps && caps.winner.msgCount >= 20) {
    awards.push(draft("caps_champion", caps, [`${Math.round(caps.winner.capsLockRate * 100)}% of messages in caps`]));
  }

  const emoji = pick(members, (member) => member.emojiDensity, "max", (member) => member.emojiDensity > 0);
  if (emoji) awards.push(draft("emoji_overload", emoji, [`${emoji.winner.emojiDensity.toFixed(1)} emoji per 100 characters`]));

  const memes = pick(members, (member) => member.mediaCount, "max", (member) => member.mediaCount > 0);
  if (memes) awards.push(draft("meme_dealer", memes, [`${memes.winner.mediaCount} media messages`]));

  const hype = pick(members, (member) => member.reactionReceived, "max", (member) => member.reactionReceived > 0);
  if (hype) awards.push(draft("hype_person", hype, [`${hype.winner.reactionReceived} reactions received`]));

  return awards;
}
