import { NextResponse } from "next/server";
import type { ApiErrorCode } from "@kudos/shared";

const MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  FILE_TOO_LARGE: "This JSON is over 50MB. Export without media or split the chat.",
  UNSUPPORTED_SHAPE: "We couldn't read this JSON. Try our sample or the Kudos format guide.",
  MALICIOUS_CONTENT: "This file failed safety checks. Remove scripts/HTML and try again.",
  TOO_MANY_MESSAGES: "Over 500k messages—pick a shorter date range and re-export.",
  PARSE_TIMEOUT: "Parsing took too long. Try a smaller export.",
  UNAUTHORIZED: "This request was blocked.",
  RATE_LIMITED: "Too many requests. Try again later.",
  CONSENT_REQUIRED: "Consent is required before analysis.",
  NOT_FOUND: "Not found.",
  INVALID_INPUT: "Invalid input.",
};

export function jsonError(code: ApiErrorCode, status: number): NextResponse {
  return NextResponse.json({ code, message: MESSAGES[code] ?? code }, { status });
}
