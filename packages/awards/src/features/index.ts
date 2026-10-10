import type { CanonicalChat } from "@kudos/chat-json";
import { computeSocial } from "./social";
import { computeTime, dateRange } from "./time";
import { emptyExemplars, type FeatureStore, type MemberFeatures } from "./types";
import { computeVolume } from "./volume";

function median(values: number[]): number | null {
  if (values.length < 30) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }
  return sorted[mid] ?? 0;
}

export function buildFeatureStore(chat: CanonicalChat, timeZone: string): FeatureStore {
  const messages = chat.messages.filter((message) => message.type !== "system");
  const volume = computeVolume(messages);
  const time = computeTime(messages, timeZone);
  const social = computeSocial(messages);

  const order: { id: string; displayName: string }[] = [];
  const seen = new Set<string>();
  for (const member of chat.members) {
    if (seen.has(member.id)) continue;
    seen.add(member.id);
    order.push(member);
  }
  for (const message of messages) {
    if (seen.has(message.authorId)) continue;
    seen.add(message.authorId);
    order.push({ id: message.authorId, displayName: message.authorId });
  }

  const members: MemberFeatures[] = order.map((member) => {
    const vol = volume.get(member.id);
    const clock = time.get(member.id);
    const tone = social.byMember.get(member.id);
    const msgCount = vol?.msgCount ?? 0;
    const charCount = vol?.charCount ?? 0;
    const exemplars = emptyExemplars();
    exemplars.funny = tone?.funny ?? [];
    exemplars.drama = tone?.drama ?? [];
    exemplars.wholesome = tone?.wholesome ?? [];
    exemplars.lateNight = clock?.lateNightExemplars ?? [];
    exemplars.links = vol?.linkExemplars ?? [];
    return {
      memberId: member.id,
      displayName: member.displayName,
      msgCount,
      charCount,
      wordCount: vol?.wordCount ?? 0,
      activeDays: clock?.activeDays.size ?? 0,
      medianResponseSec: median(tone?.replySamples ?? []),
      replySampleCount: tone?.replySamples.length ?? 0,
      lateNightShare: msgCount === 0 ? 0 : (clock?.lateNight ?? 0) / msgCount,
      earlyBirdShare: msgCount === 0 ? 0 : (clock?.earlyBird ?? 0) / msgCount,
      linkCount: vol?.linkCount ?? 0,
      mediaCount: vol?.mediaCount ?? 0,
      reactionReceived: tone?.reactionReceived ?? 0,
      laughProxy: tone?.laughProxy ?? 0,
      dramaProxy: tone?.dramaProxy ?? 0,
      capsLockRate: msgCount === 0 ? 0 : (vol?.capsMessages ?? 0) / msgCount,
      doubleTextScore: vol?.doubleTextScore ?? 0,
      mentionCount: tone?.mentionCount ?? 0,
      emojiDensity: charCount === 0 ? 0 : ((vol?.emojiCount ?? 0) / charCount) * 100,
      exemplars,
    };
  });

  return {
    featureVersion: "1",
    members,
    messageCount: messages.length,
    memberCount: members.length,
    dateRange: dateRange(messages),
    replyEdges: social.replyEdges,
  };
}
