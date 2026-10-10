import type { RoastLevel } from "@kudos/shared";
import type { FeatureStore, MemberFeatures } from "../features/types";
import { buildShortlists } from "./questions";

const STATE_CHAR_BUDGET = 80_000;
const EXEMPLAR_CHARS = 160;
const DROP_ORDER = ["links", "lateNight", "wholesome", "drama", "funny"] as const;

type ExemplarKey = (typeof DROP_ORDER)[number];

function clip(text: string): string {
  return text.replaceAll("\u0000", "").slice(0, EXEMPLAR_CHARS);
}

function memberPayload(member: MemberFeatures, includeExemplars: boolean) {
  const exemplars = includeExemplars
    ? {
        funny: member.exemplars.funny.map(clip),
        drama: member.exemplars.drama.map(clip),
        wholesome: member.exemplars.wholesome.map(clip),
        lateNight: member.exemplars.lateNight.map(clip),
        links: member.exemplars.links.map(clip),
      }
    : {};
  return {
    id: member.memberId,
    display_name: member.displayName,
    stats: {
      msg_count: member.msgCount,
      word_count: member.wordCount,
      late_night_share: member.lateNightShare,
      early_bird_share: member.earlyBirdShare,
      laugh_proxy: member.laughProxy,
      drama_proxy: member.dramaProxy,
      link_count: member.linkCount,
      media_count: member.mediaCount,
      reaction_received: member.reactionReceived,
      caps_lock_rate: member.capsLockRate,
      double_text_score: member.doubleTextScore,
      emoji_density: member.emojiDensity,
      mention_count: member.mentionCount,
    },
    exemplars,
  };
}

function stateFrom(store: FeatureStore, roastLevel: RoastLevel, members: ReturnType<typeof memberPayload>[]) {
  return {
    meta: {
      member_count: store.memberCount,
      message_count: store.messageCount,
      date_range: store.dateRange,
      tone: "roasty_friend_awards",
      roast_level: roastLevel,
    },
    members,
    shortlists: buildShortlists(store),
  };
}

export function buildJevState(
  store: FeatureStore,
  roastLevel: RoastLevel,
  options: { includeExemplars?: boolean } = {},
): unknown {
  const includeExemplars = options.includeExemplars !== false;
  const payloads = store.members.map((member) => memberPayload(member, includeExemplars));
  if (!includeExemplars) return stateFrom(store, roastLevel, payloads);

  const dropped = new Set<ExemplarKey>();
  let state = stateFrom(store, roastLevel, payloads);
  while (JSON.stringify(state).length > STATE_CHAR_BUDGET) {
    const next = DROP_ORDER.find((key) => !dropped.has(key));
    if (!next) break;
    dropped.add(next);
    for (const payload of payloads) {
      payload.exemplars[next] = [];
    }
    state = stateFrom(store, roastLevel, payloads);
  }
  return state;
}
