import { describe, expect, it } from "vitest";
import type { AwardResult } from "@kudos/awards";
import { buildScript, HEADLINE_AWARD_ORDER } from "./script";

function award(awardId: AwardResult["awardId"], winner: string, title: string): AwardResult {
  return {
    awardId,
    title,
    winnerMemberId: winner,
    source: "code",
    receipts: ["1"],
    presentationLine: `Line for ${title}`,
  };
}

describe("buildScript", () => {
  it("orders headline six and folds the rest into speed round", () => {
    const awards: AwardResult[] = [
      award("most_messages", "alex", "The Human Notification"),
      award("funniest", "sam", "Funniest"),
      award("least_messages", "jordan", "Ghost"),
      award("late_night_texter", "riley", "Night Owl"),
      award("drama_starter", "alex", "Drama"),
      award("heart_of_group", "sam", "Heart"),
      award("link_lord", "riley", "Link Lord"),
    ];
    const { lines, headlineAwardIds } = buildScript({
      groupTitle: "Apartment 4B",
      roastLevel: "medium",
      awards,
      members: [
        { id: "alex", displayName: "Alex" },
        { id: "sam", displayName: "Sam" },
        { id: "jordan", displayName: "Jordan" },
        { id: "riley", displayName: "Riley" },
      ],
    });

    expect(headlineAwardIds).toEqual(
      HEADLINE_AWARD_ORDER.filter((id) =>
        ["most_messages", "funniest", "least_messages", "late_night_texter", "drama_starter", "heart_of_group"].includes(
          id,
        ),
      ),
    );
    expect(lines.some((l) => l.id === "speed_round" && l.text.includes("Link Lord"))).toBe(true);
    expect(lines[0]?.text).toContain("Apartment 4B");
  });

  it("skips missing headline awards", () => {
    const { headlineAwardIds } = buildScript({
      groupTitle: "Trio",
      roastLevel: "gentle",
      awards: [award("most_messages", "a", "Top")],
      members: [{ id: "a", displayName: "A" }],
    });
    expect(headlineAwardIds).toEqual(["most_messages"]);
  });
});
