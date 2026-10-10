import type { CanonicalChat, CanonicalMessage } from "@kudos/chat-json";
import { describe, expect, it } from "vitest";
import { assignDeterministicAwards } from "./deterministic";
import { buildFeatureStore } from "./features";

const MEMBERS = [
  ["alex", "Alex"],
  ["sam", "Sam"],
  ["jordan", "Jordan"],
  ["riley", "Riley"],
  ["morgan", "Morgan"],
  ["casey", "Casey"],
] as const;

function chat(
  messages: CanonicalMessage[],
  members: { id: string; displayName: string }[] = MEMBERS.map(([id, displayName]) => ({
    id,
    displayName,
  })),
): CanonicalChat {
  return {
    kudosVersion: "1",
    chat: { title: "Apartment 4B", platform: "kudos", exportedAt: null },
    members,
    messages,
    warnings: [],
  };
}

function message(
  id: string,
  authorId: string,
  text: string,
  ts: string,
  extra: Partial<CanonicalMessage> = {},
): CanonicalMessage {
  return { id, authorId, text, ts, type: "message", ...extra };
}

function winner(store: ReturnType<typeof buildFeatureStore>, awardId: string): string | undefined {
  return assignDeterministicAwards(store).find((award) => award.awardId === awardId)?.winnerMemberId;
}

describe("deterministic awards", () => {
  it("picks the obvious code winners and caps exemplars", () => {
    const longJoke = `a ${"very ".repeat(40)}long bit`;
    expect(longJoke.length).toBeGreaterThan(160);
    const messages: CanonicalMessage[] = [
      message("a1", "alex", longJoke, "2024-06-01T12:00:00.000Z"),
      message("s1", "sam", "lol", "2024-06-01T12:01:00.000Z"),
      message("a2", "alex", "second bit", "2024-06-01T12:02:00.000Z"),
      message("s2", "sam", "lmao", "2024-06-01T12:03:00.000Z"),
      message("a3", "alex", "third bit", "2024-06-01T12:04:00.000Z"),
      message("s3", "sam", "haha", "2024-06-01T12:05:00.000Z"),
      message("a4", "alex", "fourth bit", "2024-06-01T12:06:00.000Z"),
      message("s4", "sam", "😂", "2024-06-01T12:07:00.000Z"),
      message("a5", "alex", "fifth bit", "2024-06-01T12:08:00.000Z"),
      message("s5", "sam", "💀", "2024-06-01T12:09:00.000Z"),
      message("a6", "alex", "sixth bit", "2024-06-01T12:10:00.000Z"),
      message("s6", "sam", "lol again", "2024-06-01T12:11:00.000Z"),
      message("a7", "alex", "https://example.com/a", "2024-06-01T15:00:00.000Z"),
      message("a8", "alex", "https://example.com/b", "2024-06-01T15:10:00.000Z"),
      message("a9", "alex", "carrying the chat", "2024-06-01T15:20:00.000Z", {
        reactions: [{ emoji: "🔥", count: 4 }],
      }),
      message("a10", "alex", "still here", "2024-06-01T16:00:00.000Z"),
      message("a11", "alex", "one more", "2024-06-01T16:30:00.000Z"),
      message("a12", "alex", "last from alex", "2024-06-01T17:00:00.000Z"),
      message("d1", "sam", "wait", "2024-06-02T18:00:00.000Z"),
      message("d2", "sam", "also this", "2024-06-02T18:00:20.000Z"),
      message("r1", "riley", "https://example.com/1", "2024-06-03T13:00:00.000Z"),
      message("r2", "riley", "https://example.com/2", "2024-06-03T13:20:00.000Z"),
      message("r3", "riley", "https://example.com/3", "2024-06-03T13:40:00.000Z"),
      message("r4", "riley", "meme", "2024-06-03T14:00:00.000Z", { mediaHint: true }),
      message("r5", "riley", "another note", "2024-06-03T14:20:00.000Z"),
      message("r6", "riley", "and another", "2024-06-03T14:40:00.000Z"),
      message("r7", "riley", "done", "2024-06-03T15:00:00.000Z"),
      message("m1", "morgan", "https://example.com/m1", "2024-06-04T07:00:00.000Z"),
      message("m2", "morgan", "https://example.com/m2", "2024-06-04T07:15:00.000Z"),
      message("m3", "morgan", "morning", "2024-06-04T07:30:00.000Z"),
      message("m4", "morgan", "coffee", "2024-06-04T07:45:00.000Z"),
      message("m5", "morgan", "walk", "2024-06-04T08:00:00.000Z"),
      message("m6", "morgan", "back", "2024-06-04T08:15:00.000Z"),
      message("c1", "casey", "https://example.com/c", "2024-06-05T02:00:00.000Z"),
      message("c2", "casey", "😂😂😂😂", "2024-06-05T02:10:00.000Z"),
      message("c3", "casey", "still up", "2024-06-05T02:20:00.000Z"),
      message("c4", "casey", "hello", "2024-06-05T03:00:00.000Z"),
      message("c5", "casey", "night", "2024-06-05T03:30:00.000Z"),
      message("j1", "jordan", "here https://example.com/j1", "2024-06-06T12:00:00.000Z"),
      message("j2", "jordan", "gone https://example.com/j2", "2024-06-06T12:05:00.000Z"),
    ];
    expect(messages).toHaveLength(40);

    const store = buildFeatureStore(chat(messages), "UTC");
    expect(store.messageCount).toBe(40);
    expect(winner(store, "most_messages")).toBe("alex");
    expect(winner(store, "least_messages")).toBe("jordan");
    expect(winner(store, "double_texter")).toBe("sam");
    expect(winner(store, "link_lord")).toBe("riley");
    expect(winner(store, "caps_champion")).toBeUndefined();

    for (const member of store.members) {
      for (const samples of Object.values(member.exemplars)) {
        expect(samples.length).toBeLessThanOrEqual(5);
        for (const sample of samples) expect(sample.length).toBeLessThanOrEqual(160);
      }
    }
    const alex = store.members.find((member) => member.memberId === "alex");
    expect(alex?.exemplars.funny[0]?.length).toBe(160);
    expect(alex?.laughProxy).toBeGreaterThan(0);
  });

  it("does not give Ghost of the Year to an inactive one-message member", () => {
    const messages: CanonicalMessage[] = [
      message("l1", "lurker", "hi", "2024-07-01T12:00:00.000Z"),
    ];
    for (let index = 0; index < 20; index += 1) {
      messages.push(message(`j${index}`, "jordan", "around", `2024-07-02T12:${String(index).padStart(2, "0")}:00.000Z`));
    }
    for (let index = 0; index < 79; index += 1) {
      const hour = String(index % 10).padStart(2, "0");
      messages.push(message(`a${index}`, "alex", "talking", `2024-07-03T${hour}:00:00.000Z`));
    }
    expect(messages).toHaveLength(100);
    const store = buildFeatureStore(
      chat(messages, [
        { id: "lurker", displayName: "Lurker" },
        { id: "jordan", displayName: "Jordan" },
        { id: "alex", displayName: "Alex" },
      ]),
      "UTC",
    );
    expect(winner(store, "least_messages")).toBe("jordan");
  });

  it("ignores system messages and breaks ties by word count", () => {
    const messages: CanonicalMessage[] = [
      message("s", "system-bot", "joined", "2024-08-01T12:00:00.000Z", { type: "system" }),
      message("a", "alex", "one two three", "2024-08-01T12:01:00.000Z"),
      message("b", "sam", "hi", "2024-08-01T12:02:00.000Z"),
    ];
    const store = buildFeatureStore(chat(messages), "UTC");
    expect(store.messageCount).toBe(2);
    expect(store.members.find((member) => member.memberId === "alex")?.msgCount).toBe(1);
    expect(winner(store, "most_messages")).toBe("alex");
  });
});
