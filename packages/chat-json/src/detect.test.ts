import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { detectFormat } from "./detect";
import { parseChatJson } from "./parse";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../../../fixtures");

describe("detectFormat", () => {
  it("detects each export before adapting it", () => {
    const telegram = parseChatJson(readFileSync(join(fixtures, "telegram-snippet.json")));
    const messenger = parseChatJson(readFileSync(join(fixtures, "messenger-snippet.json")));
    const discord = parseChatJson(readFileSync(join(fixtures, "discord-snippet.json")));
    expect(telegram).toMatchObject({ ok: true, formatDetected: "telegram" });
    expect(messenger).toMatchObject({ ok: true, formatDetected: "messenger" });
    expect(discord).toMatchObject({ ok: true, formatDetected: "discord" });
  });

  it("rejects forbidden keys in a telegram export before adapting", () => {
    const malicious = Buffer.from(
      '{"__proto__":{"admin":true},"name":"x","messages":[{"id":1,"type":"message","date_unixtime":"1","from":"A","from_id":"u","text":"hi"}]}',
    );
    expect(parseChatJson(malicious)).toMatchObject({ ok: false, code: "MALICIOUS_CONTENT" });
  });

  it("maps generic sender and timestamp messages", () => {
    const body = Buffer.from(
      JSON.stringify({
        title: "Roommates",
        messages: [{ id: "1", sender: "Alex", timestamp: "2024-01-01T00:00:00.000Z", text: "hi" }],
      }),
    );
    expect(detectFormat(JSON.parse(body.toString("utf8")) as unknown)).toBe("generic");
    const parsed = parseChatJson(body);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.formatDetected).toBe("generic");
    expect(parsed.chat.messages[0]).toMatchObject({ authorId: "Alex", text: "hi" });
  });
});
