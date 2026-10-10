import type { CanonicalChat, CanonicalMessage, FormatDetected } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function messageRecords(root: unknown): Record<string, unknown>[] {
  if (!isRecord(root) || !Array.isArray(root.messages)) return [];
  return root.messages.filter(isRecord);
}

export function detectFormat(root: unknown): FormatDetected | null {
  if (!isRecord(root)) return null;
  if ("kudos_version" in root) return "kudos_v1";
  const messages = messageRecords(root);
  if (messages.some((message) => "from_id" in message && "date_unixtime" in message)) return "telegram";
  if (messages.some((message) => "sender_name" in message && "timestamp_ms" in message)) return "messenger";
  if (
    messages.some(
      (message) => isRecord(message.author) && ("name" in message.author || "id" in message.author),
    )
  ) {
    return "discord";
  }
  if (messages.some((message) => "sender" in message && "timestamp" in message)) return "generic";
  return null;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

export function adaptGeneric(root: unknown): CanonicalChat {
  const doc = isRecord(root) ? root : {};
  const title = asString(doc.title) ?? "Chat";
  const members = new Map<string, string>();
  const messages: CanonicalMessage[] = [];
  for (const raw of messageRecords(root)) {
    const authorId = asString(raw.sender) ?? "unknown";
    members.set(authorId, authorId);
    const text =
      typeof raw.text === "string" ? raw.text : typeof raw.content === "string" ? raw.content : "";
    messages.push({
      id: asString(raw.id) ?? `g-${messages.length + 1}`,
      ts: asString(raw.timestamp) ?? new Date(0).toISOString(),
      authorId,
      text,
      type: "message",
    });
  }
  return {
    kudosVersion: "1",
    chat: { title, platform: "unknown", exportedAt: null },
    members: [...members.entries()].map(([id, displayName]) => ({ id, displayName })),
    messages,
    warnings: [],
  };
}
