import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { markCeremonyJobComplete } from "@kudos/worker/process";
import { enqueueCeremony } from "@kudos/worker/queue";
import { getDb } from "@/src/db";
import { ceremonyJobs } from "@/src/db/schema";
import { verifyMagicHourSignature } from "@/src/security/webhook";
import { logEvent } from "@/src/security/log";

type WebhookBody = {
  project_id?: string;
  status?: string;
  download_url?: string;
};

export async function POST(request: NextRequest) {
  const secret = process.env.MAGIC_HOUR_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503 });
  }

  const raw = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("x-magic-hour-signature");
  if (!verifyMagicHourSignature(raw, signature, secret)) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(raw.toString("utf8")) as WebhookBody;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const projectId = body.project_id;
  if (!projectId) return NextResponse.json({ ok: true });

  const db = getDb();
  const job = await db.query.ceremonyJobs.findFirst({ where: eq(ceremonyJobs.externalId, projectId) });
  if (!job) {
    return NextResponse.json({ ok: true });
  }

  if (body.status !== "complete") {
    return NextResponse.json({ ok: true });
  }

  let bytes: Buffer | undefined;
  if (body.download_url) {
    const response = await fetch(body.download_url);
    if (response.ok) {
      bytes = Buffer.from(await response.arrayBuffer());
    }
  }

  const updated = await markCeremonyJobComplete(projectId, bytes);
  if (updated) {
    logEvent("magic_hour_webhook_complete", { projectId });
    await enqueueCeremony(job.ceremonyId);
  }
  return NextResponse.json({ ok: true });
}
