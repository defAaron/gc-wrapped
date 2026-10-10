import { describe, expect, it } from "vitest";
import { renderPresentationLine } from "./render";
import { TEMPLATES } from "./templates";

describe("renderPresentationLine", () => {
  it("picks the same line for the same winner and roast level", () => {
    const input = {
      awardId: "funniest" as const,
      winnerMemberId: "alex",
      displayName: "Alex",
      roastLevel: "medium" as const,
      forceGentle: false,
    };
    expect(renderPresentationLine(input)).toBe(renderPresentationLine(input));
    expect(renderPresentationLine(input)).toContain("Alex");
  });

  it("uses a gentle line when spicy copy would roast blocked text", () => {
    const line = renderPresentationLine({
      awardId: "funniest",
      winnerMemberId: "alex",
      displayName: "Alex",
      roastLevel: "spicy",
      forceGentle: true,
    });
    const gentle = TEMPLATES.funniest.gentle.map((template) => template.replaceAll("{name}", "Alex"));
    expect(gentle).toContain(line);
    expect(line).not.toContain("natural disaster");
  });
});
