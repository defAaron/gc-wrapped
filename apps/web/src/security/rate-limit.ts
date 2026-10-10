import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "../db";
import { rateLimitBuckets } from "../db/schema";

function ipHash(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const pepper = process.env.SESSION_SECRET ?? "dev-only-pepper";
  return createHash("sha256").update(`${pepper}:${ip}`).digest("hex");
}

function windowStart(now: Date, windowMs: number): Date {
  const ms = Math.floor(now.getTime() / windowMs) * windowMs;
  return new Date(ms);
}

export async function checkRateLimit(
  request: NextRequest,
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean }> {
  const db = getDb();
  const now = new Date();
  const start = windowStart(now, windowMs);
  const hash = ipHash(request);
  const existing = await db.query.rateLimitBuckets.findFirst({
    where: and(
      eq(rateLimitBuckets.bucket, bucket),
      eq(rateLimitBuckets.ipHash, hash),
      eq(rateLimitBuckets.windowStart, start),
    ),
  });
  if (!existing) {
    await db.insert(rateLimitBuckets).values({ bucket, ipHash: hash, windowStart: start, count: 1 });
    return { allowed: true };
  }
  if (existing.count >= limit) return { allowed: false };
  await db
    .update(rateLimitBuckets)
    .set({ count: existing.count + 1 })
    .where(eq(rateLimitBuckets.id, existing.id));
  return { allowed: true };
}
