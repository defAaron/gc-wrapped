import type { FeatureStore, MemberFeatures } from "@kudos/awards";
import type { InferSelectModel } from "drizzle-orm";
import type { members } from "../db/schema";

type MemberRow = InferSelectModel<typeof members>;

export function applyMemberState(store: FeatureStore, memberRows: MemberRow[]): FeatureStore {
  const excluded = new Set(memberRows.filter((row) => row.excluded).map((row) => row.exportKey));
  const displayNames = new Map(memberRows.map((row) => [row.exportKey, row.displayName]));
  const filtered = store.members
    .filter((member) => !excluded.has(member.memberId))
    .map((member) => ({
      ...member,
      displayName: displayNames.get(member.memberId) ?? member.displayName,
    }));
  return {
    ...store,
    members: filtered,
    memberCount: filtered.length,
    messageCount: filtered.reduce((sum, member) => sum + member.msgCount, 0),
  };
}

export function mergeMembersInStore(store: FeatureStore, keepId: string, dropId: string): FeatureStore {
  const keep = store.members.find((member) => member.memberId === keepId);
  const drop = store.members.find((member) => member.memberId === dropId);
  if (!keep || !drop) return store;
  const merged: MemberFeatures = {
    ...keep,
    msgCount: keep.msgCount + drop.msgCount,
    charCount: keep.charCount + drop.charCount,
    wordCount: keep.wordCount + drop.wordCount,
    linkCount: keep.linkCount + drop.linkCount,
    mediaCount: keep.mediaCount + drop.mediaCount,
    reactionReceived: keep.reactionReceived + drop.reactionReceived,
    laughProxy: keep.laughProxy + drop.laughProxy,
    dramaProxy: keep.dramaProxy + drop.dramaProxy,
    mentionCount: keep.mentionCount + drop.mentionCount,
    doubleTextScore: keep.doubleTextScore + drop.doubleTextScore,
    exemplars: {
      funny: [...keep.exemplars.funny, ...drop.exemplars.funny].slice(0, 5),
      drama: [...keep.exemplars.drama, ...drop.exemplars.drama].slice(0, 5),
      wholesome: [...keep.exemplars.wholesome, ...drop.exemplars.wholesome].slice(0, 5),
      lateNight: [...keep.exemplars.lateNight, ...drop.exemplars.lateNight].slice(0, 5),
      links: [...keep.exemplars.links, ...drop.exemplars.links].slice(0, 5),
    },
  };
  return {
    ...store,
    members: store.members
      .filter((member) => member.memberId !== dropId)
      .map((member) => (member.memberId === keepId ? merged : member)),
    memberCount: store.members.length - 1,
  };
}
