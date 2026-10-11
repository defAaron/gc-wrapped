import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/src/db";
import { members } from "@/src/db/schema";
import { sniffImageType } from "@/src/media/sniff-image";
import { getOwnedSession } from "@/src/session/auth";
import { createObjectStore } from "@kudos/storage";
import { jsonError } from "@/src/security/errors";
import { assertSameOrigin } from "@/src/security/origin";
import { logEvent } from "@/src/security/log";

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; memberId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("UNAUTHORIZED", 403);
  const { id, memberId } = await context.params;
  const session = await getOwnedSession(request, id);
  if (!session) return jsonError("NOT_FOUND", 404);

  const db = getDb();
  const member = await db.query.members.findFirst({
    where: and(eq(members.sessionId, id), eq(members.id, memberId)),
  });
  if (!member) return jsonError("NOT_FOUND", 404);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return jsonError("INVALID_INPUT", 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) return jsonError("FILE_TOO_LARGE", 400);

  const kind = sniffImageType(buffer);
  if (!kind) return jsonError("INVALID_INPUT", 400);

  const ext = kind === "jpeg" ? "jpg" : "png";
  const key = `sessions/${id}/avatars/${memberId}.${ext}`;
  const store = createObjectStore();
  await store.put(key, buffer);
  await db.update(members).set({ avatarObjectKey: key }).where(eq(members.id, memberId));

  logEvent("avatar_uploaded", { sessionId: id, memberId });
  return NextResponse.json({ avatarKey: key });
}
