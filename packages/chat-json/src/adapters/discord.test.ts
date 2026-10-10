import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { adaptDiscord } from "./discord";

const fixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../../../fixtures/discord-snippet.json"),
);

describe("adaptDiscord", () => {
  it("maps author objects and marks empty attachment messages", () => {
    const chat = adaptDiscord(JSON.parse(fixture.toString("utf8")) as unknown);
    expect(chat.chat.title).toBe("general");
    expect(chat.chat.platform).toBe("discord");
    expect(chat.messages[0]).toMatchObject({ authorId: "42", text: "hello" });
    expect(chat.members).toContainEqual({ id: "42", displayName: "Riley" });
    expect(chat.messages[1]).toMatchObject({ authorId: "43", text: "", type: "message", mediaHint: true });
    expect(chat.warnings.some((warning) => warning.includes("media"))).toBe(true);
  });
});
