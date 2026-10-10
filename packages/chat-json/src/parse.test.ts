import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { MAX_MESSAGES, MAX_TEXT_CHARS, MAX_UPLOAD_BYTES } from "./limits";
import { parseChatJson } from "./parse";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function fixture(name: string): Buffer {
  return readFileSync(join(repoRoot, "fixtures", name));
}

function minimalMessage(id: string, authorId = "alex", text = "hi") {
  return {
    id,
    ts: "2024-06-01T00:00:00.000Z",
    author_id: authorId,
    text,
    type: "message",
  };
}

describe("parseChatJson", () => {
  it("parses the apartment sample as kudos v1", () => {
    const result = parseChatJson(fixture("sample-apartment-4b.json"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.formatDetected).toBe("kudos_v1");
    expect(result.chat.members).toHaveLength(6);
    expect(result.chat.chat.title).toBe("Apartment 4B");
    expect(result.chat.messages.length).toBeGreaterThanOrEqual(800);
  });

  it.each([
    ["sample-minimal.json", 3, 12],
    ["sample-trio-quick.json", 3, 76],
    ["sample-roommates.json", 4, 145],
    ["sample-study-group.json", 5, 160],
  ] as const)("parses %s", (name, memberCount, messageCount) => {
    const result = parseChatJson(fixture(name));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.formatDetected).toBe("kudos_v1");
    expect(result.chat.members).toHaveLength(memberCount);
    expect(result.chat.messages).toHaveLength(messageCount);
  });

  it("rejects an oversize body before JSON.parse", () => {
    const parse = vi.spyOn(JSON, "parse");
    const result = parseChatJson(Buffer.alloc(MAX_UPLOAD_BYTES + 1));
    expect(result).toMatchObject({ ok: false, code: "FILE_TOO_LARGE" });
    expect(parse).not.toHaveBeenCalled();
    parse.mockRestore();
  });

  it("rejects a __proto__ key", () => {
    expect(parseChatJson(fixture("malicious/proto.json"))).toMatchObject({
      ok: false,
      code: "MALICIOUS_CONTENT",
    });
  });

  it("rejects a constructor key", () => {
    expect(parseChatJson(fixture("malicious/constructor.json"))).toMatchObject({
      ok: false,
      code: "MALICIOUS_CONTENT",
    });
  });

  it("rejects a prototype key", () => {
    expect(parseChatJson(fixture("malicious/prototype.json"))).toMatchObject({
      ok: false,
      code: "MALICIOUS_CONTENT",
    });
  });

  it("rejects objects nested deeper than 32", () => {
    expect(parseChatJson(fixture("malicious/depth.json"))).toMatchObject({
      ok: false,
      code: "MALICIOUS_CONTENT",
    });
  });

  it("rejects an object with more than 10000 keys", () => {
    expect(parseChatJson(fixture("malicious/keys.json"))).toMatchObject({
      ok: false,
      code: "MALICIOUS_CONTENT",
    });
  });

  it("rejects more than 500000 messages", () => {
    const messages = Array.from({ length: MAX_MESSAGES + 1 }, (_, index) =>
      minimalMessage(String(index)),
    );
    const body = Buffer.from(JSON.stringify({ kudos_version: "1", messages }));
    expect(body.length).toBeLessThanOrEqual(MAX_UPLOAD_BYTES);
    expect(parseChatJson(body)).toMatchObject({ ok: false, code: "TOO_MANY_MESSAGES" });
  });

  it("rejects script tags in message text", () => {
    expect(parseChatJson(fixture("malicious/script.json"))).toMatchObject({
      ok: false,
      code: "MALICIOUS_CONTENT",
    });
  });

  it("strips html tags and records a warning", () => {
    const result = parseChatJson(fixture("malicious/html.json"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.chat.messages[0]?.text).toBe("hello x");
    expect(result.chat.warnings.length).toBeGreaterThan(0);
  });

  it("strips null bytes from message text", () => {
    const result = parseChatJson(fixture("malicious/null-byte.json"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.chat.messages[0]?.text).toBe("hello");
    expect(result.chat.messages[0]?.text.includes("\u0000")).toBe(false);
  });

  it("truncates text longer than 10000 characters", () => {
    const body = Buffer.from(
      JSON.stringify({
        kudos_version: "1",
        members: [{ id: "alex", display_name: "Alex" }],
        messages: [minimalMessage("m1", "alex", "a".repeat(MAX_TEXT_CHARS + 1))],
      }),
    );
    const result = parseChatJson(body);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.chat.messages[0]?.text).toHaveLength(MAX_TEXT_CHARS);
    expect(result.chat.warnings.some((warning) => warning.includes("truncated"))).toBe(true);
  });

  it("rejects an unknown shape", () => {
    expect(parseChatJson(fixture("malicious/unknown.json"))).toMatchObject({
      ok: false,
      code: "UNSUPPORTED_SHAPE",
    });
  });

  it("rejects invalid json as an unsupported shape", () => {
    expect(parseChatJson(fixture("malicious/not-json.json"))).toMatchObject({
      ok: false,
      code: "UNSUPPORTED_SHAPE",
    });
  });

  it("creates members from author ids when members are omitted", () => {
    const result = parseChatJson(
      Buffer.from(
        JSON.stringify({
          kudos_version: "1",
          chat: { title: "Untitled" },
          messages: [minimalMessage("m1", "alex", "hi")],
        }),
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.chat.members).toEqual([{ id: "alex", displayName: "alex" }]);
  });

  it("rejects more than 100 distinct senders", () => {
    const messages = Array.from({ length: 101 }, (_, index) =>
      minimalMessage(`m${index}`, `user${index}`, "hi"),
    );
    const result = parseChatJson(Buffer.from(JSON.stringify({ kudos_version: "1", messages })));
    expect(result).toMatchObject({ ok: false, code: "MALICIOUS_CONTENT" });
  });
});
