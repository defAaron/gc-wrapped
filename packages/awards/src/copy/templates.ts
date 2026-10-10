import { AWARD_TITLES, type AwardId } from "../catalog";
import type { RoastLevel } from "@kudos/shared";

function linesFor(title: string, awardId: AwardId): Record<RoastLevel, readonly [string, string, string]> {
  if (awardId === "funniest") {
    return {
      gentle: [
        "{name} wins Funniest (Allegedly). We appreciate the commitment.",
        "{name} got the laughs, and we are being nice about it.",
        "A soft nod to {name} for keeping the chat human.",
      ],
      medium: [
        "{name} treats Funniest (Allegedly) like a group project they are carrying alone.",
        "The chat treats {name} like a sitcom laugh track.",
        "{name} locked in Funniest (Allegedly) and everybody noticed.",
      ],
      spicy: [
        "{name}'s Funniest (Allegedly) run could be classified as a natural disaster.",
        "{name} did not need to sweep the laughs, and yet.",
        "Funniest (Allegedly) was never a contest once {name} logged on.",
      ],
    };
  }
  return {
    gentle: [
      `{name} wins ${title}. We appreciate the commitment.`,
      `{name} picked up ${title} with very little chaos.`,
      `Gentle version: {name} and ${title} belong together.`,
    ],
    medium: [
      `{name} treats ${title} like a group project they are carrying alone.`,
      `{name} locked in ${title} and the chat noticed.`,
      `${title} goes to {name}. The numbers started it.`,
    ],
    spicy: [
      `{name} swept ${title} and the notifications felt personal.`,
      `{name} did not need to take ${title}, and yet.`,
      `${title} was never close once {name} got going.`,
    ],
  };
}

export const TEMPLATES: Record<AwardId, Record<RoastLevel, readonly [string, string, string]>> = Object.fromEntries(
  (Object.entries(AWARD_TITLES) as [AwardId, string][]).map(([awardId, title]) => [
    awardId,
    linesFor(title, awardId),
  ]),
) as Record<AwardId, Record<RoastLevel, readonly [string, string, string]>>;
