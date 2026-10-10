import { describe, expect, it } from "vitest";
import { createFailingMagicHourClient, InsufficientCreditsError } from "./magic-hour";

describe("ceremony providers", () => {
  it("fake magic hour client triggers insufficient credits", async () => {
    const client = createFailingMagicHourClient();
    await expect(client.createVoiceLine({ lineId: "x", text: "hi" })).rejects.toBeInstanceOf(
      InsufficientCreditsError,
    );
  });
});
