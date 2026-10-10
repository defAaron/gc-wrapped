import type { CanonicalMessage } from "@kudos/chat-json";
import { pushExemplar, type ReplyEdge } from "./types";

const LAUGH = /lol|lmao|haha|😂|💀/i;
const WHOLESOME = /\b(thank|thanks|proud|love|miss you|congrats|you got this)\b/i;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const DRAMA_WINDOW_MS = 30 * 60 * 1000;

export type SocialStats = {
  reactionReceived: number;
  laughProxy: number;
  dramaProxy: number;
  mentionCount: number;
  replySamples: number[];
  funny: string[];
  drama: string[];
  wholesome: string[];
};

function blank(): SocialStats {
  return {
    reactionReceived: 0,
    laughProxy: 0,
    dramaProxy: 0,
    mentionCount: 0,
    replySamples: [],
    funny: [],
    drama: [],
    wholesome: [],
  };
}

export type SocialResult = {
  byMember: Map<string, SocialStats>;
  replyEdges: ReplyEdge[];
};

export function computeSocial(messages: CanonicalMessage[]): SocialResult {
  const sorted = [...messages].sort((left, right) => Date.parse(left.ts) - Date.parse(right.ts));
  const byMember = new Map<string, SocialStats>();
  const ensure = (memberId: string) => {
    const existing = byMember.get(memberId);
    if (existing) return existing;
    const created = blank();
    byMember.set(memberId, created);
    return created;
  };
  const edges = new Map<string, number>();

  for (const message of sorted) {
    const row = ensure(message.authorId);
    for (const reaction of message.reactions ?? []) row.reactionReceived += reaction.count;
    const mentions = message.text.match(/@[A-Za-z0-9_]+/g);
    if (mentions) row.mentionCount += mentions.length;
    if (WHOLESOME.test(message.text)) pushExemplar(row.wholesome, message.text);
  }

  for (let index = 0; index < sorted.length; index += 1) {
    const message = sorted[index];
    if (!message) continue;
    const sentAt = Date.parse(message.ts);
    for (let next = index + 1; next < sorted.length; next += 1) {
      const reply = sorted[next];
      if (!reply) continue;
      const gap = Date.parse(reply.ts) - sentAt;
      if (gap > SEVEN_DAYS_MS) break;
      if (reply.authorId === message.authorId) continue;
      ensure(message.authorId).replySamples.push(gap / 1000);
      const edgeKey = `${reply.authorId}\t${message.authorId}`;
      edges.set(edgeKey, (edges.get(edgeKey) ?? 0) + 1);
      break;
    }

    for (let next = index + 1; next < sorted.length; next += 1) {
      const reply = sorted[next];
      if (!reply) continue;
      const gap = Date.parse(reply.ts) - sentAt;
      if (gap > FIVE_MINUTES_MS) break;
      if (reply.authorId === message.authorId) continue;
      if (!LAUGH.test(reply.text)) continue;
      const row = ensure(message.authorId);
      row.laughProxy += 1;
      pushExemplar(row.funny, message.text);
      break;
    }
  }

  let start = 0;
  while (start < sorted.length) {
    const startMessage = sorted[start];
    if (!startMessage) break;
    const startMs = Date.parse(startMessage.ts);
    let end = start;
    while (end < sorted.length) {
      const candidate = sorted[end];
      if (!candidate || Date.parse(candidate.ts) - startMs > DRAMA_WINDOW_MS) break;
      end += 1;
    }
    const window = sorted.slice(start, end);
    if (window.length >= 8) {
      const counts = new Map<string, number>();
      for (const message of window) counts.set(message.authorId, (counts.get(message.authorId) ?? 0) + 1);
      for (const [memberId, count] of counts) {
        if (count < 3) continue;
        const row = ensure(memberId);
        row.dramaProxy += 1;
        const sample = window.find((message) => message.authorId === memberId);
        if (sample) pushExemplar(row.drama, sample.text);
      }
      start = end;
    } else {
      start += 1;
    }
  }

  const replyEdges = [...edges.entries()].map(([key, count]) => {
    const [fromId, toId] = key.split("\t");
    return { fromId: fromId ?? "", toId: toId ?? "", count };
  });

  return { byMember, replyEdges };
}
