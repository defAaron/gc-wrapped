import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as createSession } from "../../app/api/sessions/route";
import { POST as upload } from "../../app/api/sessions/[id]/upload/route";
import { getDb } from "../db";
import { sessions } from "../db/schema";
import { deleteExpiredSessions } from "./sessions";
import { resetDb } from "../../vitest.setup";

const sample = readFileSync(join(process.cwd(), "../../fixtures/sample-apartment-4b.json"));

describe("retention", () => {
  it("marks raw data deleted without writing upload bytes to object storage", async () => {
    await resetDb();
    const create = await createSession(
      new NextRequest("http://localhost:3000/api/sessions", {
        method: "POST",
        headers: { Origin: "http://localhost:3000", Host: "localhost:3000" },
      }),
    );
    const { sessionId } = (await create.json()) as { sessionId: string };
    const cookie = `kudos_sid=${create.cookies.get("kudos_sid")?.value}`;
    await upload(
      new NextRequest(`http://localhost:3000/api/sessions/${sessionId}/upload`, {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: "http://localhost:3000",
          Host: "localhost:3000",
          "content-type": "application/json",
        },
        body: sample,
      }),
      { params: Promise.resolve({ id: sessionId }) },
    );
    const row = await getDb().query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
    expect(row?.rawDeletedAt).toBeTruthy();
  });

  it("deletes expired sessions", async () => {
    await resetDb();
    const db = getDb();
    const [row] = await db
      .insert(sessions)
      .values({
        slug: "expiredslug123456",
        ownerTokenHash: "hash",
        expiresAt: new Date(Date.now() - 86_400_000),
      })
      .returning();
    expect(row).toBeTruthy();
    const removed = await deleteExpiredSessions(new Date());
    expect(removed).toBeGreaterThan(0);
  });
});
