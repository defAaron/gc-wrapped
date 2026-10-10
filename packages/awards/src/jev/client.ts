export type JevAnswer = {
  type: string;
  choice?: string;
  noul?: number;
  confidence?: number;
};

export type JevDecision = {
  answers: Record<string, JevAnswer>;
  usage: { input_tokens: number };
};

export type JevClient = {
  decide(input: {
    model: "jev-1.13.0";
    state: unknown;
    questions: Record<string, unknown>;
  }): Promise<JevDecision>;
};

export const JEV_MODEL = "jev-1.13.0" as const;
export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

export class JevMaxTokensError extends Error {
  constructor() {
    super("max_tokens_exceeded");
    this.name = "JevMaxTokensError";
  }
}

export class HttpJevClient implements JevClient {
  async decide(input: {
    model: "jev-1.13.0";
    state: unknown;
    questions: Record<string, unknown>;
  }): Promise<JevDecision> {
    const apiKey = process.env.TYPESAFE_API_KEY;
    if (!apiKey) {
      throw new Error("JEV_NOT_CONFIGURED");
    }
    const response = await fetch(JEV_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    });
    const body = await response.text();
    if (response.status === 400 && body.includes("max_tokens_exceeded")) {
      throw new JevMaxTokensError();
    }
    if (!response.ok) {
      throw new Error("Jev request failed");
    }
    return JSON.parse(body) as JevDecision;
  }
}
