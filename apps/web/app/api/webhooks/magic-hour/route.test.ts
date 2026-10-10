import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";
import { resetDb } from "../../../../vitest.setup";

describe("magic hour webhook", () => {
  afterEach(async () => {
    await resetDb();
  });

  it("rejects a bad signature with 401", async () => {
    process.env.MAGIC_HOUR_WEBHOOK_SECRET = "test-webhook-secret";
    const body = Buffer.from(JSON.stringify({ project_id: "proj-1", status: "complete" }));
    const good = createHmac("sha256", "test-webhook-secret").update(body).digest("hex");
    const bad = good.slice(0, -1) + (good.endsWith("a") ? "b" : "a");

    const response = await POST(
      new NextRequest("http://localhost:3000/api/webhooks/magic-hour", {
        method: "POST",
        headers: { "x-magic-hour-signature": bad },
        body,
      }),
    );
    expect(response.status).toBe(401);
  });
});
