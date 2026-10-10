import type { CanonicalMessage } from "@kudos/chat-json";
import { pushExemplar } from "./types";

export type VolumeStats = {
  msgCount: number;
  charCount: number;
  wordCount: number;
  linkCount: number;
  mediaCount: number;
  capsMessages: number;
  emojiCount: number;
  doubleTextScore: number;
  linkExemplars: string[];
};

function blank(): VolumeStats {
  return {
    msgCount: 0,
    charCount: 0,
    wordCount: 0,
    linkCount: 0,
    mediaCount: 0,
    capsMessages: 0,
    emojiCount: 0,
    doubleTextScore: 0,
    linkExemplars: [],
  };
}

function isCaps(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length === 0) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  return upper / letters.length > 0.6;
}

export function computeVolume(messages: CanonicalMessage[]): Map<string, VolumeStats> {
  const stats = new Map<string, VolumeStats>();
  const ensure = (memberId: string) => {
    const existing = stats.get(memberId);
    if (existing) return existing;
    const created = blank();
    stats.set(memberId, created);
    return created;
  };

  for (const message of messages) {
    const row = ensure(message.authorId);
    const text = message.text;
    row.msgCount += 1;
    row.charCount += text.length;
    row.wordCount += text.trim() ? text.trim().split(/\s+/).length : 0;
    const links = text.match(/https?:\/\/[^\s]+/gi);
    if (links) {
      row.linkCount += links.length;
      pushExemplar(row.linkExemplars, text);
    }
    if (message.mediaHint) row.mediaCount += 1;
    if (isCaps(text)) row.capsMessages += 1;
    const emoji = text.match(/\p{Extended_Pictographic}/gu);
    if (emoji) row.emojiCount += emoji.length;
  }

  const byAuthor = new Map<string, CanonicalMessage[]>();
  for (const message of messages) {
    const list = byAuthor.get(message.authorId) ?? [];
    list.push(message);
    byAuthor.set(message.authorId, list);
  }
  for (const [memberId, authored] of byAuthor) {
    const row = ensure(memberId);
    authored.sort((left, right) => Date.parse(left.ts) - Date.parse(right.ts));
    for (let index = 1; index < authored.length; index += 1) {
      const previous = authored[index - 1];
      const current = authored[index];
      if (!previous || !current) continue;
      const gap = Date.parse(current.ts) - Date.parse(previous.ts);
      if (gap >= 0 && gap <= 60_000) row.doubleTextScore += 1;
    }
  }

  return stats;
}
