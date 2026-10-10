import type { RoastLevel } from "@kudos/shared";
import type { AwardId } from "../catalog";
import { isBlocked } from "./blocklist";
import { TEMPLATES } from "./templates";

export function stableIndex(seed: string, size: number): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash % size;
}

export function renderPresentationLine(input: {
  awardId: AwardId;
  winnerMemberId: string;
  displayName: string;
  roastLevel: RoastLevel;
  forceGentle: boolean;
}): string {
  const level = input.forceGentle ? "gentle" : input.roastLevel;
  const pool = TEMPLATES[input.awardId][level];
  const chosen = pool[stableIndex(`${input.awardId}:${input.winnerMemberId}:${level}`, pool.length)] ?? pool[0];
  const line = (chosen ?? "This one stays kind.").replaceAll("{name}", input.displayName);
  if (!isBlocked(line)) return line;
  if (level !== "gentle") {
    return renderPresentationLine({ ...input, forceGentle: true });
  }
  return "This one stays kind.";
}
