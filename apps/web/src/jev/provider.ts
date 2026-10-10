import { HttpJevClient, type JevClient } from "@kudos/awards";

let testClient: JevClient | null = null;

const localStubJev: JevClient = {
  decide: async () => ({ answers: {}, usage: { input_tokens: 0 } }),
};

export function setJevClientForTests(client: JevClient | null): void {
  testClient = client;
}

export function getJevClient(): JevClient {
  if (testClient) return testClient;
  if (!process.env.TYPESAFE_API_KEY?.trim()) return localStubJev;
  return new HttpJevClient();
}
