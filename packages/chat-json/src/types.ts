import type { ApiErrorCode } from "@kudos/shared";

export type FormatDetected = "kudos_v1" | "telegram" | "messenger" | "discord" | "generic";

export type CanonicalMessage = {
  id: string;
  ts: string;
  authorId: string;
  text: string;
  type: "message" | "system";
  reactions?: { emoji: string; count: number }[];
  replyToId?: string;
};

export type CanonicalChat = {
  kudosVersion: "1";
  chat: {
    title: string;
    platform: "kudos" | "telegram" | "messenger" | "discord" | "unknown";
    exportedAt: string | null;
  };
  members: { id: string; displayName: string }[];
  messages: CanonicalMessage[];
  warnings: string[];
};

export type ParseErrorCode = Extract<
  ApiErrorCode,
  "FILE_TOO_LARGE" | "UNSUPPORTED_SHAPE" | "MALICIOUS_CONTENT" | "TOO_MANY_MESSAGES" | "PARSE_TIMEOUT"
>;

export type ParseFailure = {
  ok: false;
  code: ParseErrorCode;
  message: string;
};

export type ParseSuccess = {
  ok: true;
  formatDetected: FormatDetected;
  chat: CanonicalChat;
};
