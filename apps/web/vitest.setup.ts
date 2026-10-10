import { sql } from "drizzle-orm";
import { beforeAll } from "vitest";
import { getDb } from "./src/db";
import { initTestDb } from "./src/db/test-db";

process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? "test-session-secret";
process.env.VITEST = "true";

beforeAll(async () => {
  await initTestDb();
  await resetDb();
});

export async function resetDb(): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    TRUNCATE TABLE share_reports, rate_limit_buckets, awards, analyses, uploads, members, sessions
    RESTART IDENTITY CASCADE
  `);
}
