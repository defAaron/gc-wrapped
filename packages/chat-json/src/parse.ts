import { z } from "zod";
import {
  MAX_DEPTH,
  MAX_KEYS_PER_OBJECT,
  MAX_MESSAGES,
  MAX_SENDERS,
  MAX_TEXT_CHARS,
  MAX_UPLOAD_BYTES,
  PARSE_TIMEOUT_MS,
} from "./limits";
import type { CanonicalChat, CanonicalMessage, ParseFailure, ParseSuccess } from "./types";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const messageSchema = z.object({
  id: z.string().min(1),
  ts: z.string().datetime({ offset: true }),
  author_id: z.string().min(1),
  text: z.string().optional(),
  type: z.enum(["message", "system"]).optional(),
  reactions: z
    .array(
      z.object({
        emoji: z.string(),
        count: z.number().int().nonnegative(),
      }),
    )
    .optional(),
  reply_to_id: z.string().optional(),
});

const kudosSchema = z.object({
  kudos_version: z.literal("1"),
  chat: z
    .object({
      title: z.string().optional(),
      platform: z.enum(["kudos", "telegram", "messenger", "discord", "unknown"]).optional(),
      exported_at: z.string().nullable().optional(),
    })
    .optional(),
  members: z
    .array(
      z.object({
        id: z.string().min(1),
        display_name: z.string(),
      }),
    )
    .optional(),
  messages: z.array(messageSchema),
});

class ParseControlError extends Error {
  constructor(
    readonly code: ParseFailure["code"],
    message: string,
  ) {
    super(message);
  }
}

function failure(code: ParseFailure["code"], message: string): ParseFailure {
  return { ok: false, code, message };
}

function assertDeadline(started: number): void {
  if (Date.now() - started > PARSE_TIMEOUT_MS) {
    throw new ParseControlError("PARSE_TIMEOUT", "Parsing exceeded 30 seconds.");
  }
}

function assertDepth(source: string): void {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{" || char === "[") {
      depth += 1;
      if (depth > MAX_DEPTH) {
        throw new ParseControlError("MALICIOUS_CONTENT", "JSON nesting is too deep.");
      }
      continue;
    }
    if (char === "}" || char === "]") depth -= 1;
  }
}

function warn(warnings: string[], warning: string): void {
  if (!warnings.includes(warning)) warnings.push(warning);
}

function cleanText(raw: string, warnings: string[]): string {
  const withoutNulls = raw.replaceAll("\u0000", "");
  if (/<script/i.test(withoutNulls)) {
    throw new ParseControlError("MALICIOUS_CONTENT", "Message text contains a script tag.");
  }
  let text = withoutNulls;
  if (text.length > MAX_TEXT_CHARS) {
    text = text.slice(0, MAX_TEXT_CHARS);
    warn(warnings, "truncated message text");
  }
  const stripped = text.replace(/<[^>]*>/g, "");
  if (stripped !== text) warn(warnings, "stripped html tags");
  return stripped;
}

function parseValue(source: string): unknown {
  return JSON.parse(source, (key, value: unknown) => {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new ParseControlError("MALICIOUS_CONTENT", "JSON contains a forbidden key.");
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (Object.keys(value).length > MAX_KEYS_PER_OBJECT) {
        throw new ParseControlError("MALICIOUS_CONTENT", "JSON object has too many keys.");
      }
    }
    if (key === "messages" && Array.isArray(value) && value.length > MAX_MESSAGES) {
      throw new ParseControlError("TOO_MANY_MESSAGES", "Chat has too many messages.");
    }
    return value;
  });
}

export function parseChatJson(bytes: Buffer): ParseSuccess | ParseFailure {
  if (bytes.length > MAX_UPLOAD_BYTES) {
    return failure("FILE_TOO_LARGE", "Upload exceeds 50 MB.");
  }

  const started = Date.now();
  const source = bytes.toString("utf8").replaceAll("\u0000", "");

  try {
    assertDeadline(started);
    if (/<script/i.test(source)) {
      throw new ParseControlError("MALICIOUS_CONTENT", "Upload contains a script tag.");
    }
    assertDepth(source);
    assertDeadline(started);

    const parsed = parseValue(source);
    assertDeadline(started);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !("kudos_version" in parsed)) {
      return failure("UNSUPPORTED_SHAPE", "Unrecognized chat JSON.");
    }

    const validated = kudosSchema.safeParse(parsed);
    if (!validated.success) {
      return failure("UNSUPPORTED_SHAPE", "Unrecognized chat JSON.");
    }

    const raw = validated.data;
    const authorIds = new Set(raw.messages.map((message) => message.author_id));
    if (authorIds.size > MAX_SENDERS) {
      return failure("MALICIOUS_CONTENT", "Chat has too many senders.");
    }

    const seenIds = new Set<string>();
    for (const message of raw.messages) {
      if (seenIds.has(message.id)) {
        return failure("UNSUPPORTED_SHAPE", "Message ids must be unique.");
      }
      seenIds.add(message.id);
    }

    const warnings: string[] = [];
    const messages: CanonicalMessage[] = [];
    for (let index = 0; index < raw.messages.length; index += 1) {
      if (index % 5000 === 0) assertDeadline(started);
      const rawMessage = raw.messages[index];
      if (!rawMessage) continue;
      const message: CanonicalMessage = {
        id: rawMessage.id,
        ts: rawMessage.ts,
        authorId: rawMessage.author_id,
        text: cleanText(rawMessage.text ?? "", warnings),
        type: rawMessage.type ?? "message",
      };
      if (rawMessage.reactions && rawMessage.reactions.length > 0) {
        message.reactions = rawMessage.reactions.map((reaction) => ({
          emoji: reaction.emoji,
          count: reaction.count,
        }));
      }
      if (rawMessage.reply_to_id !== undefined) message.replyToId = rawMessage.reply_to_id;
      messages.push(message);
    }

    const members = new Map<string, string>();
    for (const member of raw.members ?? []) members.set(member.id, member.display_name);
    for (const authorId of authorIds) {
      if (!members.has(authorId)) members.set(authorId, authorId);
    }

    const platform = raw.chat?.platform ?? "kudos";
    const chat: CanonicalChat = {
      kudosVersion: "1",
      chat: {
        title: raw.chat?.title ?? "Untitled chat",
        platform,
        exportedAt: raw.chat?.exported_at ?? null,
      },
      members: [...members.entries()].map(([id, displayName]) => ({ id, displayName })),
      messages,
      warnings,
    };

    return { ok: true, formatDetected: "kudos_v1", chat };
  } catch (error) {
    if (error instanceof ParseControlError) return failure(error.code, error.message);
    if (error instanceof SyntaxError) return failure("UNSUPPORTED_SHAPE", "Body is not JSON.");
    return failure("MALICIOUS_CONTENT", "Rejected unsafe JSON.");
  }
}
