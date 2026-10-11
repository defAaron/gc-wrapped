import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getCeremonyProgress } from "@/src/ceremony/progress";
import { getDb } from "@/src/db";
import { sessions } from "@/src/db/schema";
import { createObjectStore } from "@kudos/storage";
import { jsonError } from "@/src/security/errors";

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const db = getDb();
  const session = await db.query.sessions.findFirst({ where: eq(sessions.slug, slug) });
  if (!session) return jsonError("NOT_FOUND", 404);

  const ceremony = await getCeremonyProgress(session.id);
  if (ceremony.status !== "complete" || !ceremony.videoObjectKey) {
    return jsonError("NOT_FOUND", 404);
  }

  const store = createObjectStore();
  const body = await store.get(ceremony.videoObjectKey);
  if (!body) return jsonError("NOT_FOUND", 404);

  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
