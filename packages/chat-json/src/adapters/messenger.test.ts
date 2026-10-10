import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { adaptMessenger } from "./messenger";

const fixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../../../fixtures/messenger-snippet.json"),
);

describe("adaptMessenger", () => {
  it("sorts newest-first exports oldest-first and groups reactions", () => {
    const chat = adaptMessenger(JSON.parse(fixture.toString("utf8")) as unknown);
    expect(chat.chat.title).toBe("Messenger chat");
    expect(chat.messages.map((message) => message.text)).toEqual(["earlier message", "", "later message"]);
    expect(chat.messages[0]?.authorId).toBe("Alex");
    expect(chat.messages[2]?.reactions).toEqual([{ emoji: "❤️", count: 2 }]);
    expect(chat.members).toEqual([
      { id: "Alex", displayName: "Alex" },
      { id: "Sam", displayName: "Sam" },
    ]);
  });
});
