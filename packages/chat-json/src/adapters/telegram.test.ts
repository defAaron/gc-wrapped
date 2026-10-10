import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { adaptTelegram } from "./telegram";

const fixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../../../fixtures/telegram-snippet.json"),
);

describe("adaptTelegram", () => {
  it("joins text arrays and marks service messages as system", () => {
    const chat = adaptTelegram(JSON.parse(fixture.toString("utf8")) as unknown);
    expect(chat.chat.title).toBe("Apartment 4B");
    expect(chat.chat.platform).toBe("telegram");
    expect(chat.messages[0]).toMatchObject({
      id: "1042",
      authorId: "user123",
      text: "vote: pizza or thai",
      type: "message",
      ts: new Date(1710466867 * 1000).toISOString(),
    });
    expect(chat.members).toContainEqual({ id: "user123", displayName: "Jordan" });
    expect(chat.messages[1]?.type).toBe("system");
  });
});
