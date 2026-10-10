export const BLOCKLIST = [
  "kill yourself",
  "kill myself",
  "bipolar",
  "anorexic",
  "overweight",
  "child porn",
  "underage sex",
] as const;

export function isBlocked(text: string): boolean {
  const haystack = text.toLowerCase();
  return BLOCKLIST.some((token) => haystack.includes(token));
}

export function exemplarsAreOnlyCrisis(samples: string[]): boolean {
  return samples.length > 0 && samples.every((sample) => isBlocked(sample));
}
