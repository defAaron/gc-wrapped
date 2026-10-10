import type { CanonicalChat, CanonicalMessage } from "@kudos/chat-json";
import { describe, expect, it } from "vitest";
import { analyzeChat } from "./analyze";
import { assignDeterministicAwards } from "./deterministic";
import { buildFeatureStore } from "./features";
import { emptyExemplars, type FeatureStore, type MemberFeatures } from "./features/types";
import { JevMaxTokensError, type JevClient, type JevDecision } from "./jev/client";
import { buildJevState } from "./jev/state";

function member(id: string, displayName: string, overrides: Partial<MemberFeatures> = {}): MemberFeatures {
  return {
    memberId: id,
    displayName,
    msgCount: 0,
    charCount: 0,
    wordCount: 0,
    activeDays: 1,
    medianResponseSec: null,
    replySampleCount: 0,
    lateNightShare: 0,
    earlyBirdShare: 0,
    linkCount: 0,
    mediaCount: 0,
    reactionReceived: 0,
    laughProxy: 0,
    dramaProxy: 0,
    capsLockRate: 0,
    doubleTextScore: 0,
    mentionCount: 0,
    emojiDensity: 0,
    exemplars: emptyExemplars(),
    ...overrides,
  };
}

function store(members: MemberFeatures[]): FeatureStore {
  return {
    featureVersion: "1",
    members,
    messageCount: members.reduce((sum, person) => sum + person.msgCount, 0),
    memberCount: members.length,
    dateRange: { start: "2024-06-01T00:00:00.000Z", end: "2024-06-02T00:00:00.000Z" },
    replyEdges: [],
  };
}

function fake(decision: JevDecision): JevClient {
  return { decide: async () => decision };
}

function answer(choice: string, confidence: number, noul: number): JevDecision {
  return {
    answers: {
      funniest_winner: { type: "choice", choice, confidence },
      funniest_confidence_gate: { type: "noul", noul },
    },
    usage: { input_tokens: 120 },
  };
}

describe("analyzeChat", () => {
  const funnyStore = store([
    member("alex", "Alex", { laughProxy: 10, msgCount: 12, wordCount: 20, exemplars: { ...emptyExemplars(), funny: ["nobody asked"] } }),
    member("sam", "Sam", { laughProxy: 4, msgCount: 8, wordCount: 10 }),
    member("jordan", "Jordan", { laughProxy: 1, msgCount: 6, wordCount: 8 }),
  ]);

  it("keeps a confident Jev funniest choice", async () => {
    const result = await analyzeChat({ store: funnyStore, roastLevel: "medium", jev: fake(answer("alex", 0.8, 0.9)) });
    const funniest = result.awards.find((award) => award.awardId === "funniest");
    expect(funniest).toMatchObject({ winnerMemberId: "alex", source: "jev" });
    expect(funniest?.jev).toMatchObject({ questionId: "funniest_winner", confidence: 0.8 });
    expect(result.jevModel).toBe("jev-1.13.0");
    expect(result.inputTokens).toBe(120);
  });

  it("falls back to the laugh leader when the confidence gate is low", async () => {
    const result = await analyzeChat({ store: funnyStore, roastLevel: "medium", jev: fake(answer("sam", 0.8, 0.4)) });
    const funniest = result.awards.find((award) => award.awardId === "funniest");
    expect(funniest).toMatchObject({ winnerMemberId: "alex", source: "code" });
  });

  it("caps every member at four awards", async () => {
    const crowded = store([
      member("alex", "Alex", {
        msgCount: 40,
        wordCount: 80,
        lateNightShare: 0.8,
        earlyBirdShare: 0.4,
        linkCount: 8,
        doubleTextScore: 5,
        emojiDensity: 9,
      }),
      member("sam", "Sam", {
        msgCount: 25,
        wordCount: 40,
        lateNightShare: 0.2,
        earlyBirdShare: 0.1,
        linkCount: 3,
        doubleTextScore: 1,
        emojiDensity: 2,
      }),
      member("jordan", "Jordan", { msgCount: 20, wordCount: 20 }),
    ]);
    const before = new Map<string, number>();
    for (const award of assignDeterministicAwards(crowded)) {
      before.set(award.winnerMemberId, (before.get(award.winnerMemberId) ?? 0) + 1);
    }
    expect(Math.max(...before.values())).toBeGreaterThan(4);
    const result = await analyzeChat({
      store: crowded,
      roastLevel: "medium",
      jev: fake({ answers: {}, usage: { input_tokens: 40 } }),
    });
    const after = new Map<string, number>();
    for (const award of result.awards) after.set(award.winnerMemberId, (after.get(award.winnerMemberId) ?? 0) + 1);
    for (const count of after.values()) expect(count).toBeLessThanOrEqual(4);
  });

  it("drops a crisis exemplar and does not use the spicy line", async () => {
    const crisis = store([
      member("alex", "Alex", {
        laughProxy: 5,
        msgCount: 4,
        exemplars: { ...emptyExemplars(), funny: ["I want to kill myself"] },
      }),
      member("sam", "Sam", { laughProxy: 1, msgCount: 3 }),
    ]);
    const result = await analyzeChat({
      store: crisis,
      roastLevel: "spicy",
      jev: fake(answer("alex", 0.8, 0.9)),
    });
    expect(JSON.stringify(result.awards).toLowerCase()).not.toContain("kill myself");
    const funniest = result.awards.find((award) => award.awardId === "funniest");
    expect(funniest).toBeUndefined();
  });

  it("retries once without exemplars after max_tokens_exceeded", async () => {
    const states: unknown[] = [];
    let calls = 0;
    const jev: JevClient = {
      async decide(body) {
        states.push(body.state);
        calls += 1;
        if (calls === 1) throw new JevMaxTokensError();
        return { answers: {}, usage: { input_tokens: 8 } };
      },
    };
    const featured = store([
      member("alex", "Alex", {
        msgCount: 3,
        exemplars: { ...emptyExemplars(), funny: ["ONLY_IN_EXEMPLAR"] },
      }),
    ]);
    await analyzeChat({ store: featured, roastLevel: "gentle", jev });
    expect(calls).toBe(2);
    expect(JSON.stringify(states[0])).toContain("ONLY_IN_EXEMPLAR");
    expect(JSON.stringify(states[1])).not.toContain("ONLY_IN_EXEMPLAR");
  });
});

describe("buildJevState", () => {
  it("omits message text that was not chosen as an exemplar", () => {
    const secret = "SECRET_NOT_AN_EXEMPLAR";
    const messages: CanonicalMessage[] = [
      {
        id: "m1",
        ts: "2024-06-01T15:00:00.000Z",
        authorId: "alex",
        text: secret,
        type: "message",
      },
      {
        id: "m2",
        ts: "2024-06-01T15:05:00.000Z",
        authorId: "sam",
        text: "ok",
        type: "message",
      },
    ];
    const chat: CanonicalChat = {
      kudosVersion: "1",
      chat: { title: "Apartment 4B", platform: "kudos", exportedAt: null },
      members: [
        { id: "alex", displayName: "Alex" },
        { id: "sam", displayName: "Sam" },
      ],
      messages,
      warnings: [],
    };
    const features = buildFeatureStore(chat, "UTC");
    expect(JSON.stringify(features.members.flatMap((person) => Object.values(person.exemplars).flat()))).not.toContain(secret);
    expect(JSON.stringify(buildJevState(features, "medium"))).not.toContain(secret);
  });

  it("drops exemplar categories until the state is under 80000 characters", () => {
    const huge = "x".repeat(30_000);
    const features = store([
      member("alex", "Alex", {
        exemplars: { funny: [huge], drama: [huge], wholesome: [huge], lateNight: [huge], links: [huge] },
      }),
    ]);
    expect(JSON.stringify(buildJevState(features, "medium")).length).toBeLessThan(80_000);
  });
});
