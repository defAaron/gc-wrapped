import type { CanonicalChat, CanonicalMessage } from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  return undefined;
}

export function adaptMessenger(root: unknown): CanonicalChat {
  const doc = isRecord(root) ? root : {};
  const title = asString(doc.title) ?? "Messenger chat";
  const members = new Map<string, string>();
  if (Array.isArray(doc.participants)) {
    for (const participant of doc.participants) {
      if (!isRecord(participant)) continue;
      const name = asString(participant.name);
      if (name) members.set(name, name);
    }
  }

  const rawMessages = Array.isArray(doc.messages) ? doc.messages : [];
  const messages: CanonicalMessage[] = [];
  for (const raw of rawMessages) {
    if (!isRecord(raw)) continue;
    const authorId = asString(raw.sender_name) ?? "unknown";
    if (!members.has(authorId)) members.set(authorId, authorId);
    const millis = Number(raw.timestamp_ms);
    const counts = new Map<string, number>();
    if (Array.isArray(raw.reactions)) {
      for (const reaction of raw.reactions) {
        if (!isRecord(reaction)) continue;
        const emoji = asString(reaction.reaction);
        if (!emoji) continue;
        counts.set(emoji, (counts.get(emoji) ?? 0) + 1);
      }
    }
    const message: CanonicalMessage = {
      id: `ms-${messages.length + 1}`,
      ts: Number.isFinite(millis) ? new Date(millis).toISOString() : new Date(0).toISOString(),
      authorId,
      text: typeof raw.content === "string" ? raw.content : "",
      type: "message",
    };
    if (counts.size > 0) {
      message.reactions = [...counts.entries()].map(([emoji, count]) => ({ emoji, count }));
    }
    messages.push(message);
  }

  messages.sort((left, right) => (left.ts < right.ts ? -1 : left.ts > right.ts ? 1 : 0));

  return {
    kudosVersion: "1",
    chat: { title, platform: "messenger", exportedAt: null },
    members: [...members.entries()].map(([id, displayName]) => ({ id, displayName })),
    messages,
    warnings: [],
  };
}
