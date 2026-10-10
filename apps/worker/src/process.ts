import { eq } from "drizzle-orm";
import { isBlocked } from "@kudos/awards";
import type { AwardResult } from "@kudos/awards";
import type { CeremonyStatus, RoastLevel } from "@kudos/shared";
import { getWorkerDb, schema } from "./db";
import { readSlideshowMp4, renderSlideshow } from "./concat";
import {
  createFailingMagicHourClient,
  createMagicHourClient,
  InsufficientCreditsError,
  type MagicHourClient,
} from "./magic-hour";
import { buildScript } from "./script";
import { createObjectStore } from "./object-store";

const { ceremonies, ceremonyJobs, sessions, members, analyses, awards } = schema;

const CEREMONY_TIMEOUT_MS = 15 * 60 * 1000;

function sanitizeLine(text: string): string {
  if (isBlocked(text)) {
    return "A friend who always shows up for the group.";
  }
  return text;
}

function resolveMagicHourClient(): MagicHourClient | null {
  if (process.env.CEREMONY_PROVIDER === "fallback") return null;
  if (process.env.CEREMONY_PROVIDER === "fake_fail") return createFailingMagicHourClient();
  try {
    return createMagicHourClient();
  } catch {
    return null;
  }
}

async function setCeremonyStatus(ceremonyId: string, status: CeremonyStatus) {
  const db = getWorkerDb();
  await db.update(ceremonies).set({ status }).where(eq(ceremonies.id, ceremonyId));
}

async function runFallback(ceremonyId: string, sessionId: string): Promise<void> {
  const db = getWorkerDb();
  const store = createObjectStore();
  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
  if (!session) throw new Error("session_missing");

  const memberRows = await db.query.members.findMany({ where: eq(members.sessionId, sessionId) });
  const analysis = await db.query.analyses.findFirst({ where: eq(analyses.sessionId, sessionId) });
  if (!analysis) throw new Error("analysis_missing");
  const awardRows = await db.query.awards.findMany({ where: eq(awards.analysisId, analysis.id) });

  const awardResults: AwardResult[] = awardRows.map((row) => {
    const winner = memberRows.find((m) => m.id === row.winnerMemberId);
    const runner = row.runnerUpMemberId
      ? memberRows.find((m) => m.id === row.runnerUpMemberId)
      : undefined;
    const base: AwardResult = {
      awardId: row.awardId as AwardResult["awardId"],
      title: row.title,
      winnerMemberId: winner?.exportKey ?? row.winnerMemberId,
      source: row.source as "code" | "jev",
      receipts: row.receipts,
      presentationLine: row.presentationLine,
    };
    if (runner?.exportKey) base.runnerUpMemberId = runner.exportKey;
    if (row.exemplarQuote) base.exemplarQuote = row.exemplarQuote;
    return base;
  });

  const scriptInputMembers = memberRows
    .filter((m) => !m.excluded)
    .map((m) => ({ id: m.exportKey, displayName: m.displayName }));

  const { lines } = buildScript({
    groupTitle: session.groupTitle ?? "Your chat",
    roastLevel: session.roastLevel as RoastLevel,
    awards: awardResults,
    members: scriptInputMembers,
  });

  const awardTitles = new Map(awardRows.map((row) => [row.awardId, row.title]));
  await setCeremonyStatus(ceremonyId, "concatenating");

  const rendered = await renderSlideshow({
    groupTitle: session.groupTitle ?? "Your chat",
    lines: lines.map((line) => ({ ...line, text: sanitizeLine(line.text) })),
    awardTitles,
  });

  await setCeremonyStatus(ceremonyId, "uploading");
  const mp4 = await readSlideshowMp4(rendered);
  const videoKey = `sessions/${sessionId}/final.mp4`;
  await store.put(videoKey, mp4);

  await db
    .update(ceremonies)
    .set({
      status: "complete",
      videoObjectKey: videoKey,
      durationSec: rendered.durationSec,
      fallbackUsed: true,
      completedAt: new Date(),
    })
    .where(eq(ceremonies.id, ceremonyId));

  await db.update(sessions).set({ status: "complete" }).where(eq(sessions.id, sessionId));

  const jobRows = await db.query.ceremonyJobs.findMany({ where: eq(ceremonyJobs.ceremonyId, ceremonyId) });
  for (const job of jobRows) {
    await db.update(ceremonyJobs).set({ status: "complete" }).where(eq(ceremonyJobs.id, job.id));
  }
}

async function runMagicHourPipeline(ceremonyId: string, sessionId: string, client: MagicHourClient): Promise<void> {
  const db = getWorkerDb();
  await setCeremonyStatus(ceremonyId, "tts_batch");
  const jobRows = await db.query.ceremonyJobs.findMany({ where: eq(ceremonyJobs.ceremonyId, ceremonyId) });
  const ttsJobs = jobRows.filter((j) => j.type === "tts");

  for (const job of ttsJobs) {
    if (!job.lineId) continue;
    const lineText = job.objectKey;
    if (!lineText) continue;
    try {
      const { projectId, credits } = await client.createVoiceLine({ lineId: job.lineId, text: lineText });
      await db
        .update(ceremonyJobs)
        .set({
          externalId: projectId,
          status: "running",
          attempt: job.attempt + 1,
        })
        .where(eq(ceremonyJobs.id, job.id));
      if (credits) {
        const ceremony = await db.query.ceremonies.findFirst({ where: eq(ceremonies.id, ceremonyId) });
        await db
          .update(ceremonies)
          .set({ mhCreditsTotal: (ceremony?.mhCreditsTotal ?? 0) + credits })
          .where(eq(ceremonies.id, ceremonyId));
      }
    } catch (error) {
      if (error instanceof InsufficientCreditsError) throw error;
      if (job.attempt >= 1) throw error;
      await db.update(ceremonyJobs).set({ attempt: job.attempt + 1 }).where(eq(ceremonyJobs.id, job.id));
      throw error;
    }
  }

  await setCeremonyStatus(ceremonyId, "mh_clips_running");
  throw new MagicHourPipelineIncompleteError();
}

class MagicHourPipelineIncompleteError extends Error {
  constructor() {
    super("magic_hour_pipeline_not_implemented");
  }
}

export async function seedCeremonyJobs(ceremonyId: string, sessionId: string): Promise<void> {
  const db = getWorkerDb();
  const existing = await db.query.ceremonyJobs.findMany({ where: eq(ceremonyJobs.ceremonyId, ceremonyId) });
  if (existing.length > 0) return;

  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
  if (!session) return;
  const memberRows = await db.query.members.findMany({ where: eq(members.sessionId, sessionId) });
  const analysis = await db.query.analyses.findFirst({ where: eq(analyses.sessionId, sessionId) });
  if (!analysis) return;
  const awardRows = await db.query.awards.findMany({ where: eq(awards.analysisId, analysis.id) });

  const awardResults: AwardResult[] = awardRows.map((row) => {
    const winner = memberRows.find((m) => m.id === row.winnerMemberId);
    return {
      awardId: row.awardId as AwardResult["awardId"],
      title: row.title,
      winnerMemberId: winner?.exportKey ?? row.winnerMemberId,
      source: row.source as "code" | "jev",
      receipts: row.receipts,
      presentationLine: row.presentationLine,
    };
  });

  const scriptMembers = memberRows
    .filter((m) => !m.excluded)
    .map((m) => ({ id: m.exportKey, displayName: m.displayName }));

  const { lines } = buildScript({
    groupTitle: session.groupTitle ?? "Your chat",
    roastLevel: session.roastLevel as RoastLevel,
    awards: awardResults,
    members: scriptMembers,
  });

  for (const line of lines) {
    await db.insert(ceremonyJobs).values({
      ceremonyId,
      type: "tts",
      lineId: line.id,
      status: "pending",
      objectKey: sanitizeLine(line.text),
    });
  }
  await db.insert(ceremonyJobs).values({
    ceremonyId,
    type: "concat",
    lineId: "final",
    status: "pending",
  });
}

export async function processCeremony(ceremonyId: string): Promise<void> {
  const db = getWorkerDb();
  const ceremony = await db.query.ceremonies.findFirst({ where: eq(ceremonies.id, ceremonyId) });
  if (!ceremony) return;
  if (ceremony.status === "complete" || ceremony.status === "failed") return;

  const started = ceremony.createdAt.getTime();
  if (Date.now() - started > CEREMONY_TIMEOUT_MS) {
    await runFallback(ceremonyId, ceremony.sessionId);
    return;
  }

  await seedCeremonyJobs(ceremonyId, ceremony.sessionId);
  const client = resolveMagicHourClient();

  try {
    if (!client) {
      await runFallback(ceremonyId, ceremony.sessionId);
      return;
    }
    await runMagicHourPipeline(ceremonyId, ceremony.sessionId, client);
  } catch (error) {
    if (
      error instanceof InsufficientCreditsError ||
      error instanceof MagicHourPipelineIncompleteError ||
      (error instanceof Error && error.message.includes("MAGIC_HOUR"))
    ) {
      await runFallback(ceremonyId, ceremony.sessionId);
      return;
    }
    await db
      .update(ceremonies)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(ceremonies.id, ceremonyId));
    await db.update(sessions).set({ status: "failed" }).where(eq(sessions.id, ceremony.sessionId));
  }
}

export async function markCeremonyJobComplete(externalId: string, downloadBytes?: Buffer): Promise<boolean> {
  const db = getWorkerDb();
  const job = await db.query.ceremonyJobs.findFirst({ where: eq(ceremonyJobs.externalId, externalId) });
  if (!job) return false;

  const ceremony = await db.query.ceremonies.findFirst({ where: eq(ceremonies.id, job.ceremonyId) });
  if (!ceremony) return false;

  if (downloadBytes && job.lineId) {
    const store = createObjectStore();
    const key = `sessions/${ceremony.sessionId}/clips/${job.lineId}.mp4`;
    await store.put(key, downloadBytes);
    await db
      .update(ceremonyJobs)
      .set({ status: "complete", objectKey: key })
      .where(eq(ceremonyJobs.id, job.id));
  } else {
    await db.update(ceremonyJobs).set({ status: "complete" }).where(eq(ceremonyJobs.id, job.id));
  }
  return true;
}
