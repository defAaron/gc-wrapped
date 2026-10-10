import type { CanonicalMessage } from "@kudos/chat-json";
import { pushExemplar } from "./types";

export type TimeStats = {
  lateNight: number;
  earlyBird: number;
  activeDays: Set<string>;
  lateNightExemplars: string[];
};

function blank(): TimeStats {
  return { lateNight: 0, earlyBird: 0, activeDays: new Set(), lateNightExemplars: [] };
}

export function localHour(iso: string, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  })
    .formatToParts(new Date(iso))
    .find((part) => part.type === "hour")?.value;
  const parsed = Number(hour ?? "0");
  return parsed === 24 ? 0 : parsed;
}

function localDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function computeTime(messages: CanonicalMessage[], timeZone: string): Map<string, TimeStats> {
  const stats = new Map<string, TimeStats>();
  for (const message of messages) {
    const row = stats.get(message.authorId) ?? blank();
    const hour = localHour(message.ts, timeZone);
    if (hour >= 0 && hour <= 4) {
      row.lateNight += 1;
      pushExemplar(row.lateNightExemplars, message.text);
    } else if (hour >= 5 && hour <= 8) {
      row.earlyBird += 1;
    }
    row.activeDays.add(localDay(message.ts, timeZone));
    stats.set(message.authorId, row);
  }
  return stats;
}

export function dateRange(messages: CanonicalMessage[]): { start: string; end: string } | null {
  if (messages.length === 0) return null;
  const sorted = [...messages].sort((left, right) => Date.parse(left.ts) - Date.parse(right.ts));
  const start = sorted[0]?.ts;
  const end = sorted[sorted.length - 1]?.ts;
  if (!start || !end) return null;
  return { start, end };
}
