import { eq, type InferSelectModel } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/src/db";
import { members, sessions } from "@/src/db/schema";
import { getOwnedSession } from "@/src/session/auth";
import { buildOwnerSessionDto, stripInternal } from "@/src/session/dto";
import { applyMemberState, mergeMembersInStore } from "@/src/session/feature-store";
import { deleteSessionArtifacts } from "@/src/retention/sessions";
import { jsonError } from "@/src/security/errors";
import { assertSameOrigin } from "@/src/security/origin";
import { logEvent } from "@/src/security/log";
import type { FeatureStore } from "@kudos/awards";
import type { RoastLevel } from "@kudos/shared";

type PatchBody = {
  roastLevel?: RoastLevel;
  groupTitle?: string;
  consent?: boolean;
  publishQuotes?: boolean;
  members?: { id: string; displayName?: string; excluded?: boolean }[];
  merge?: [string, string][];
};

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getOwnedSession(request, id);
  if (!session) return jsonError("NOT_FOUND", 404);
  const dto = await buildOwnerSessionDto(id, session);
  const body = stripInternal(dto);
  if (JSON.stringify(body).includes('"messages"')) {
    return jsonError("INVALID_INPUT", 500);
  }
  return NextResponse.json(body);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("UNAUTHORIZED", 403);
  const { id } = await context.params;
  const session = await getOwnedSession(request, id);
  if (!session) return jsonError("NOT_FOUND", 404);
  const body = (await request.json()) as PatchBody;
  const db = getDb();

  if (body.roastLevel) {
    await db.update(sessions).set({ roastLevel: body.roastLevel }).where(eq(sessions.id, id));
  }
  if (body.groupTitle !== undefined) {
    await db.update(sessions).set({ groupTitle: body.groupTitle }).where(eq(sessions.id, id));
  }
  if (body.consent === true) {
    await db.update(sessions).set({ consentAt: new Date() }).where(eq(sessions.id, id));
  }
  if (body.publishQuotes !== undefined) {
    await db.update(sessions).set({ publishQuotes: body.publishQuotes }).where(eq(sessions.id, id));
  }

  const memberRows: InferSelectModel<typeof members>[] = await db.query.members.findMany({
    where: eq(members.sessionId, id),
  });
  const byId = new Map(memberRows.map((row) => [row.id, row]));

  if (body.members) {
    for (const patch of body.members) {
      const row = byId.get(patch.id);
      if (!row) continue;
      await db
        .update(members)
        .set({
          displayName: patch.displayName ?? row.displayName,
          excluded: patch.excluded ?? row.excluded,
        })
        .where(eq(members.id, row.id));
    }
  }

  let featureStore = session.featureStoreJson as FeatureStore | null;
  if (body.merge && featureStore) {
    for (const pair of body.merge) {
      const [keepId, dropId] = pair;
      const keep = byId.get(keepId);
      const drop = byId.get(dropId);
      if (!keep || !drop) continue;
      featureStore = mergeMembersInStore(featureStore, keep.exportKey, drop.exportKey);
      await db
        .update(members)
        .set({
          messageCount: keep.messageCount + drop.messageCount,
          excluded: false,
        })
        .where(eq(members.id, keep.id));
      await db.update(members).set({ excluded: true }).where(eq(members.id, drop.id));
    }
    await db.update(sessions).set({ featureStoreJson: featureStore }).where(eq(sessions.id, id));
  }

  const refreshed = await db.query.sessions.findFirst({ where: eq(sessions.id, id) });
  if (refreshed?.featureStoreJson) {
    const updatedMembers = await db.query.members.findMany({ where: eq(members.sessionId, id) });
    const nextStore = applyMemberState(refreshed.featureStoreJson as FeatureStore, updatedMembers);
    await db.update(sessions).set({ featureStoreJson: nextStore }).where(eq(sessions.id, id));
  }

  logEvent("session_patched", { sessionId: id });
  const dto = await buildOwnerSessionDto(id, (await getOwnedSession(request, id)) ?? session);
  return NextResponse.json(stripInternal(dto));
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("UNAUTHORIZED", 403);
  const { id } = await context.params;
  const session = await getOwnedSession(request, id);
  if (!session) return jsonError("NOT_FOUND", 404);
  await deleteSessionArtifacts(id);
  logEvent("session_deleted", { sessionId: id });
  return NextResponse.json({ ok: true });
}
