const REDACT = new Set(["text", "exemplar", "body", "authorization", "cookie"]);

export function logEvent(name: string, fields: Record<string, unknown> = {}): void {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (REDACT.has(key.toLowerCase())) continue;
    safe[key] = value;
  }
  console.info(name, safe);
}
