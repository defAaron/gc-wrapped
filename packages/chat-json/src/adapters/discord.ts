import type { CanonicalChat, CanonicalMessage } from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

export function adaptDiscord(root: unknown): CanonicalChat {
  const doc = isRecord(root) ? root : {};
  const channel = isRecord(doc.channel) ? doc.channel : undefined;
  const guild = isRecord(doc.guild) ? doc.guild : undefined;
  const title = asString(channel?.name) ?? asString(guild?.name) ?? "Discord chat";
  const rawMessages = Array.isArray(doc.messages) ? doc.messages : [];
  const members = new Map<string, string>();
  const messages: CanonicalMessage[] = [];
  const warnings: string[] = [];

  for (const raw of rawMessages) {
    if (!isRecord(raw)) continue;
    const author = isRecord(raw.author) ? raw.author : undefined;
    const authorId = asString(author?.id) ?? "unknown";
    const displayName = asString(author?.name) ?? authorId;
    members.set(authorId, displayName);
    const content = typeof raw.content === "string" ? raw.content : "";
    const hasAttachment = Array.isArray(raw.attachments) && raw.attachments.length > 0;
    const message: CanonicalMessage = {
      id: asString(raw.id) ?? `dc-${messages.length + 1}`,
      ts: asString(raw.timestamp) ?? new Date(0).toISOString(),
      authorId,
      text: content,
      type: "message",
    };
    if (hasAttachment) {
      message.mediaHint = true;
      if (!warnings.includes("attachment stored as media hint")) {
        warnings.push("attachment stored as media hint");
      }
    }
    messages.push(message);
  }

  return {
    kudosVersion: "1",
    chat: { title, platform: "discord", exportedAt: null },
    members: [...members.entries()].map(([id, displayName]) => ({ id, displayName })),
    messages,
    warnings,
  };
}
