import { NextResponse, type NextRequest } from "next/server";
import { getCeremonyProgress } from "@/src/ceremony/progress";
import { getOwnedSession } from "@/src/session/auth";
import { createLocalObjectStore } from "@/src/storage/local-disk";
import { jsonError } from "@/src/security/errors";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getOwnedSession(request, id);
  if (!session) return jsonError("NOT_FOUND", 404);

  const ceremony = await getCeremonyProgress(id);
  if (ceremony.status !== "complete" || !ceremony.videoObjectKey) {
    return jsonError("NOT_FOUND", 404);
  }

  const store = createLocalObjectStore();
  const body = await store.get(ceremony.videoObjectKey);
  if (!body) return jsonError("NOT_FOUND", 404);

  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(body.byteLength),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
