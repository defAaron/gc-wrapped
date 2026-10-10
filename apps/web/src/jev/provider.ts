import { HttpJevClient, type JevClient } from "@kudos/awards";

let testClient: JevClient | null = null;

export function setJevClientForTests(client: JevClient | null): void {
  testClient = client;
}

export function getJevClient(): JevClient {
  if (testClient) return testClient;
  return new HttpJevClient();
}
