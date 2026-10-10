import { NextResponse, type NextRequest } from "next/server";
import { getCeremonyProgress } from "@/src/ceremony/progress";
import { getOwnedSession } from "@/src/session/auth";
import { jsonError } from "@/src/security/errors";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getOwnedSession(request, id);
  if (!session) return jsonError("NOT_FOUND", 404);

  const progress = await getCeremonyProgress(id);
  if (!progress.ceremonyId) {
    return NextResponse.json({ status: session.status, progress: 0, stage: null });
  }

  return NextResponse.json({
    status: progress.status ?? "rendering",
    progress: progress.progress,
    stage: progress.stage,
    fallbackUsed: progress.fallbackUsed,
  });
}
