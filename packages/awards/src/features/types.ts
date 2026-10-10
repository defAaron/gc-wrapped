export type MemberFeatures = {
  memberId: string;
  displayName: string;
  msgCount: number;
  charCount: number;
  wordCount: number;
  activeDays: number;
  medianResponseSec: number | null;
  replySampleCount: number;
  lateNightShare: number;
  earlyBirdShare: number;
  linkCount: number;
  mediaCount: number;
  reactionReceived: number;
  laughProxy: number;
  dramaProxy: number;
  capsLockRate: number;
  doubleTextScore: number;
  mentionCount: number;
  emojiDensity: number;
  exemplars: {
    funny: string[];
    drama: string[];
    wholesome: string[];
    lateNight: string[];
    links: string[];
  };
};

export type ReplyEdge = {
  fromId: string;
  toId: string;
  count: number;
};

export type FeatureStore = {
  featureVersion: "1";
  members: MemberFeatures[];
  messageCount: number;
  memberCount: number;
  dateRange: { start: string; end: string } | null;
  replyEdges: ReplyEdge[];
};

export const EXEMPLAR_LIMIT = 5;
export const EXEMPLAR_CHARS = 160;

export function pushExemplar(list: string[], text: string): void {
  const clipped = text.replaceAll("\u0000", "").trim().slice(0, EXEMPLAR_CHARS);
  if (!clipped || list.length >= EXEMPLAR_LIMIT || list.includes(clipped)) return;
  list.push(clipped);
}

export function emptyExemplars(): MemberFeatures["exemplars"] {
  return { funny: [], drama: [], wholesome: [], lateNight: [], links: [] };
}
