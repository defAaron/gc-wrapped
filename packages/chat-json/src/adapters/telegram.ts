import type { CanonicalChat, CanonicalMessage } from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function telegramText(text: unknown): string {
  if (typeof text === "string") return text;
  if (!Array.isArray(text)) return "";
  let combined = "";
  for (const part of text) {
    if (typeof part === "string") combined += part;
    else if (isRecord(part) && typeof part.text === "string") combined += part.text;
  }
  return combined;
}

export function adaptTelegram(root: unknown): CanonicalChat {
  const doc = isRecord(root) ? root : {};
  const title = asString(doc.name) ?? "Telegram chat";
  const rawMessages = Array.isArray(doc.messages) ? doc.messages : [];
  const members = new Map<string, string>();
  const messages: CanonicalMessage[] = [];

  for (const raw of rawMessages) {
    if (!isRecord(raw)) continue;
    const authorId = asString(raw.from_id) ?? asString(raw.actor_id) ?? "unknown";
    const displayName = asString(raw.from) ?? asString(raw.actor) ?? authorId;
    members.set(authorId, displayName);
    const seconds = Number(raw.date_unixtime);
    const message: CanonicalMessage = {
      id: asString(raw.id) ?? `tg-${messages.length + 1}`,
      ts: Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : new Date(0).toISOString(),
      authorId,
      text: telegramText(raw.text),
      type: raw.type === "service" ? "system" : "message",
    };
    messages.push(message);
  }

  return {
    kudosVersion: "1",
    chat: { title, platform: "telegram", exportedAt: null },
    members: [...members.entries()].map(([id, displayName]) => ({ id, displayName })),
    messages,
    warnings: [],
  };
}
