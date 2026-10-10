export type ApiError = { code: string; message: string };

export type SessionMember = {
  id: string;
  exportKey: string;
  displayName: string;
  messageCount: number;
  excluded: boolean;
};

export type AwardCard = {
  awardId: string;
  title: string;
  winner: { memberId: string; displayName: string };
  presentationLine: string;
  receipts: string[];
};

export type SessionDto = {
  status: string;
  roastLevel: string;
  groupTitle: string | null;
  slug: string;
  members: SessionMember[];
  analysis: { awards: AwardCard[] } | null;
  ceremony: null;
};

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(
      response.status >= 500
        ? "Server error — is Postgres running? Try: docker compose up -d postgres && pnpm --filter @kudos/web db:push"
        : "Empty response from server.",
    );
  }
  let body: T | ApiError;
  try {
    body = JSON.parse(text) as T | ApiError;
  } catch {
    throw new Error("Server returned a non-JSON response. Check the terminal running pnpm dev.");
  }
  if (!response.ok) {
    const error = body as ApiError;
    throw new Error(error.code || error.message || "Request failed");
  }
  return body as T;
}

export async function createSession(): Promise<{ sessionId: string; uploadUrl: string }> {
  const response = await fetch("/api/sessions", { method: "POST", credentials: "include" });
  return parse(response);
}

export async function uploadJson(sessionId: string, file: File): Promise<unknown> {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch(`/api/sessions/${sessionId}/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  return parse(response);
}

export async function patchSession(sessionId: string, body: Record<string, unknown>): Promise<SessionDto> {
  const response = await fetch(`/api/sessions/${sessionId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return parse(response);
}

export async function analyzeSession(sessionId: string, regenerate = false): Promise<unknown> {
  const response = await fetch(`/api/sessions/${sessionId}/analyze`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(regenerate ? { regenerate: true } : {}),
  });
  return parse(response);
}

export async function getSession(sessionId: string): Promise<SessionDto> {
  const response = await fetch(`/api/sessions/${sessionId}`, { credentials: "include" });
  return parse(response);
}

export async function publishSession(sessionId: string): Promise<{ shareUrl: string; slug: string }> {
  const response = await fetch(`/api/sessions/${sessionId}/publish`, {
    method: "POST",
    credentials: "include",
  });
  return parse(response);
}
