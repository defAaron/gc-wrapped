import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { parseChatJson } from "@kudos/chat-json";
import { buildFeatureStore } from "@kudos/awards";
import { getDb } from "@/src/db";
import { members, sessions, uploads } from "@/src/db/schema";
import { getOwnedSession } from "@/src/session/auth";
import { jsonError } from "@/src/security/errors";
import { assertSameOrigin } from "@/src/security/origin";
import { checkRateLimit } from "@/src/security/rate-limit";
import { logEvent } from "@/src/security/log";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("UNAUTHORIZED", 403);
  const limited = await checkRateLimit(request, "upload", 5, 60 * 60 * 1000);
  if (!limited.allowed) return jsonError("RATE_LIMITED", 429);

  const { id } = await context.params;
  const session = await getOwnedSession(request, id);
  if (!session) return jsonError("NOT_FOUND", 404);

  let bytes: Buffer;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("INVALID_INPUT", 400);
    bytes = Buffer.from(await file.arrayBuffer());
  } else {
    bytes = Buffer.from(await request.arrayBuffer());
  }

  const parsed = parseChatJson(bytes);
  if (!parsed.ok) return jsonError(parsed.code, 400);

  const featureStore = buildFeatureStore(parsed.chat, "UTC");
  const db = getDb();
  await db.delete(members).where(eq(members.sessionId, id));

  const insertedMembers = await db
    .insert(members)
    .values(
      parsed.chat.members.map((member) => {
        const stats = featureStore.members.find((row) => row.memberId === member.id);
        return {
          sessionId: id,
          exportKey: member.id,
          displayName: member.displayName,
          messageCount: stats?.msgCount ?? 0,
        };
      }),
    )
    .returning();

  await db.insert(uploads).values({
    sessionId: id,
    formatDetected: parsed.formatDetected,
    byteSize: bytes.length,
    messageCount: parsed.chat.messages.length,
    memberCount: parsed.chat.members.length,
    validationWarnings: parsed.chat.warnings,
  });

  await db
    .update(sessions)
    .set({
      status: "mapping",
      groupTitle: parsed.chat.chat.title,
      featureStoreJson: featureStore,
      rawDeletedAt: new Date(),
    })
    .where(eq(sessions.id, id));

  logEvent("session_uploaded", { sessionId: id, format: parsed.formatDetected });
  return NextResponse.json({
    formatDetected: parsed.formatDetected,
    messageCount: parsed.chat.messages.length,
    memberCount: parsed.chat.members.length,
    members: insertedMembers.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      messageCount: row.messageCount,
    })),
    warnings: parsed.chat.warnings,
  });
}
