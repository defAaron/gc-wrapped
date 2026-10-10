export type RoastLevel = "gentle" | "medium" | "spicy";

export type SessionStatus =
  | "created"
  | "uploaded"
  | "mapping"
  | "analyzing"
  | "preview"
  | "rendering"
  | "complete"
  | "failed";

export const CEREMONY_QUEUE_NAME = "ceremony";

export type CeremonyStatus =
  | "pending"
  | "tts_batch"
  | "mh_clips_running"
  | "concatenating"
  | "uploading"
  | "complete"
  | "failed";

export const ACTIVE_CEREMONY_STATUSES: CeremonyStatus[] = [
  "pending",
  "tts_batch",
  "mh_clips_running",
  "concatenating",
  "uploading",
];

export type ApiErrorCode =
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_SHAPE"
  | "MALICIOUS_CONTENT"
  | "TOO_MANY_MESSAGES"
  | "PARSE_TIMEOUT"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "CONSENT_REQUIRED"
  | "NOT_FOUND"
  | "INVALID_INPUT";
