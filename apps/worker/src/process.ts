import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { isBlocked } from "@kudos/awards";
import type { AwardResult } from "@kudos/awards";
import { VIDEO_TTL_MS, type CeremonyStatus, type RoastLevel } from "@kudos/shared";
import { getWorkerDb, schema } from "./db";
import {
  concatVideoBuffers,
  readSlideshowMp4,
  renderInitialsPng,
  renderSlideshow,
  renderSpeedRoundCard,
} from "./concat";
import {
  createFailingMagicHourClient,
  createMagicHourClient,
  InsufficientCreditsError,
  type MagicHourClient,
} from "./magic-hour";

export type { MagicHourClient } from "./magic-hour";
import { TTV_INTRO_PROMPT, TTV_OUTRO_PROMPT } from "./prompts";
import { buildScript, type ScriptLine } from "./script";
import { createObjectStore } from "./object-store";

const { ceremonies, ceremonyJobs, sessions, members, analyses, awards } = schema;

const CEREMONY_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_VIDEO_IN_FLIGHT = 3;

type CeremonyJobRow = typeof ceremonyJobs.$inferSelect;
type CeremonyTick = "complete" | "failed" | "continue" | "missing";

let testClient: MagicHourClient | null = null;
let assetDownloader: ((url: string) => Promise<Buffer>) | null = null;

export function setMagicHourClientForTests(client: MagicHourClient | null): void {
  testClient = client;
}

export function setAssetDownloaderForTests(downloader: ((url: string) => Promise<Buffer>) | null): void {
  assetDownloader = downloader;
}

export class ClipRetriesExhausted extends Error {
  constructor() {
    super("clip_retries_exhausted");
    this.name = "ClipRetriesExhausted";
  }
}

function sanitizeLine(text: string): string {
  if (isBlocked(text)) return "A friend who always shows up for the group.";
  return text;
}

function videoExpiry(from = new Date()): Date {
  return new Date(from.getTime() + VIDEO_TTL_MS);
}

function resolveMagicHourClient(): MagicHourClient | null {
  if (process.env.CEREMONY_PROVIDER === "fallback") return null;
  if (process.env.CEREMONY_PROVIDER === "fake_fail") return createFailingMagicHourClient();
  if (testClient) return testClient;
  try {
    return createMagicHourClient();
  } catch {
    return null;
  }
}

function shouldFallback(error: unknown): boolean {
  if (error instanceof InsufficientCreditsError || error instanceof ClipRetriesExhausted) return true;
  return error instanceof Error && error.message.includes("MAGIC_HOUR");
}

function logCeremony(event: string, details: Record<string, unknown>): void {
  console.log(event, details);
}

function assetExtension(bytes: Buffer, fallback: string): string {
  const head = bytes.subarray(0, 4).toString("ascii");
  if (head === "RIFF") return "wav";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  return fallback;
}

async function audioEndSeconds(bytes: Buffer): Promise<number> {
  const dir = await mkdtemp(join(tmpdir(), "kudos-audio-"));
  const file = join(dir, "line.wav");
  await writeFile(file, bytes);
  try {
    const seconds = await new Promise<number>((resolve, reject) => {
      const proc = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
      let out = "";
      proc.stdout?.on("data", (chunk) => {
        out += String(chunk);
      });
      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) resolve(Number(out.trim()));
        else reject(new Error("ffprobe_failed"));
      });
    });
    if (!Number.isFinite(seconds) || seconds <= 0) return 5;
    return Math.min(12, Math.max(1, Number(seconds.toFixed(2))));
  } catch {
    return 5;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function magicHourAssetRef(
  client: MagicHourClient,
  key: string,
  type: "image" | "audio",
  fallbackExtension: string,
): Promise<{ ref: string; endSeconds?: number }> {
  const store = createObjectStore();
  const bytes = await store.get(key);
  if (!bytes) throw new Error("missing_asset");
  if (!client.uploadAsset) {
    return { ref: await store.signedGetUrl(key, 60 * 60) };
  }
  const extension = assetExtension(bytes, fallbackExtension);
  const uploaded = await client.uploadAsset({ bytes, type, extension });
  if (type === "audio") return { ref: uploaded.filePath, endSeconds: await audioEndSeconds(bytes) };
  return { ref: uploaded.filePath };
}

async function downloadAsset(url: string): Promise<Buffer> {
  if (assetDownloader) return assetDownloader(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error("asset_download_failed");
  return Buffer.from(await response.arrayBuffer());
}

async function setCeremonyStatus(ceremonyId: string, status: CeremonyStatus) {
  const db = getWorkerDb();
  await db.update(ceremonies).set({ status }).where(eq(ceremonies.id, ceremonyId));
}

async function addCredits(ceremonyId: string, credits: number | undefined) {
  if (!credits) return;
  const db = getWorkerDb();
  const ceremony = await db.query.ceremonies.findFirst({ where: eq(ceremonies.id, ceremonyId) });
  await db
    .update(ceremonies)
    .set({ mhCreditsTotal: (ceremony?.mhCreditsTotal ?? 0) + credits })
    .where(eq(ceremonies.id, ceremonyId));
}

async function loadCeremonyContext(sessionId: string) {
  const db = getWorkerDb();
  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
  if (!session) throw new Error("session_missing");
  const memberRows = await db.query.members.findMany({ where: eq(members.sessionId, sessionId) });
  const analysis = await db.query.analyses.findFirst({ where: eq(analyses.sessionId, sessionId) });
  if (!analysis) throw new Error("analysis_missing");
  const awardRows = await db.query.awards.findMany({ where: eq(awards.analysisId, analysis.id) });
  const awardResults: AwardResult[] = awardRows.map((row) => {
    const winner = memberRows.find((member) => member.id === row.winnerMemberId);
    const runner = row.runnerUpMemberId
      ? memberRows.find((member) => member.id === row.runnerUpMemberId)
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
  const scriptMembers = memberRows
    .filter((member) => !member.excluded)
    .map((member) => ({ id: member.exportKey, displayName: member.displayName }));
  const script = buildScript({
    groupTitle: session.groupTitle ?? "Your chat",
    roastLevel: session.roastLevel as RoastLevel,
    awards: awardResults,
    members: scriptMembers,
  });
  return { session, memberRows, awardRows, script };
}

async function runFallback(ceremonyId: string, sessionId: string): Promise<void> {
  const db = getWorkerDb();
  const store = createObjectStore();
  const { session, script, awardRows } = await loadCeremonyContext(sessionId);
  const awardTitles = new Map(awardRows.map((row) => [row.awardId, row.title]));
  await setCeremonyStatus(ceremonyId, "concatenating");

  const rendered = await renderSlideshow({
    groupTitle: session.groupTitle ?? "Your chat",
    lines: script.lines.map((line) => ({ ...line, text: sanitizeLine(line.text) })),
    awardTitles,
  });

  await setCeremonyStatus(ceremonyId, "uploading");
  const mp4 = await readSlideshowMp4(rendered);
  const videoKey = `sessions/${sessionId}/final.mp4`;
  await store.put(videoKey, mp4);
  const completedAt = new Date();

  await db
    .update(ceremonies)
    .set({
      status: "complete",
      videoObjectKey: videoKey,
      durationSec: rendered.durationSec,
      fallbackUsed: true,
      completedAt,
      videoExpiresAt: videoExpiry(completedAt),
    })
    .where(eq(ceremonies.id, ceremonyId));

  await db.update(sessions).set({ status: "complete" }).where(eq(sessions.id, sessionId));

  const jobRows = await db.query.ceremonyJobs.findMany({ where: eq(ceremonyJobs.ceremonyId, ceremonyId) });
  for (const job of jobRows) {
    await db.update(ceremonyJobs).set({ status: "complete" }).where(eq(ceremonyJobs.id, job.id));
  }
}

async function loadJobs(ceremonyId: string): Promise<CeremonyJobRow[]> {
  const db = getWorkerDb();
  return db.query.ceremonyJobs.findMany({ where: eq(ceremonyJobs.ceremonyId, ceremonyId) });
}

async function ensureInitials(sessionId: string): Promise<void> {
  const db = getWorkerDb();
  const store = createObjectStore();
  const memberRows = await db.query.members.findMany({ where: eq(members.sessionId, sessionId) });
  for (const member of memberRows) {
    if (member.excluded || member.avatarObjectKey) continue;
    const png = await renderInitialsPng(member.displayName);
    const key = `sessions/${sessionId}/avatars/${member.id}-initials.png`;
    await store.put(key, png);
    await db.update(members).set({ avatarObjectKey: key }).where(eq(members.id, member.id));
  }
}

async function noteFailure(job: CeremonyJobRow): Promise<void> {
  const next = job.attempt + 1;
  if (next >= 2) throw new ClipRetriesExhausted();
  const db = getWorkerDb();
  await db
    .update(ceremonyJobs)
    .set({ status: "pending", externalId: null, attempt: next })
    .where(eq(ceremonyJobs.id, job.id));
}

async function pollJobs(jobs: CeremonyJobRow[], client: MagicHourClient, sessionId: string, kind: "audio" | "video") {
  const db = getWorkerDb();
  const store = createObjectStore();
  for (const job of jobs) {
    if (!job.externalId || !job.lineId) continue;
    const project = await client.getProject(job.externalId);
    if (project.status === "pending") continue;
    if (project.status === "failed") {
      logCeremony("ceremony_clip_failed", { lineId: job.lineId, type: job.type, error: project.error ?? "failed" });
      await noteFailure(job);
      continue;
    }
    if (!project.downloadUrl) {
      continue;
    }
    let bytes: Buffer;
    try {
      bytes = await downloadAsset(project.downloadUrl);
    } catch (error) {
      logCeremony("ceremony_clip_download_failed", {
        lineId: job.lineId,
        type: job.type,
        reason: error instanceof Error ? error.message : "download_failed",
      });
      continue;
    }
    const key =
      kind === "audio"
        ? `sessions/${sessionId}/audio/${job.lineId}.mp3`
        : `sessions/${sessionId}/clips/${job.lineId}.mp4`;
    await store.put(key, bytes);
    await db
      .update(ceremonyJobs)
      .set({ status: "complete", objectKey: key })
      .where(eq(ceremonyJobs.id, job.id));
  }
}

async function startTts(jobs: CeremonyJobRow[], client: MagicHourClient, ceremonyId: string) {
  const db = getWorkerDb();
  for (const job of jobs) {
    if (!job.lineId || !job.scriptText) continue;
    try {
      const created = await client.createVoiceLine({ lineId: job.lineId, text: job.scriptText });
      await addCredits(ceremonyId, created.credits);
      await db
        .update(ceremonyJobs)
        .set({ externalId: created.projectId, status: "running" })
        .where(eq(ceremonyJobs.id, job.id));
    } catch (error) {
      if (error instanceof InsufficientCreditsError) throw error;
      logCeremony("ceremony_clip_create_failed", {
        lineId: job.lineId,
        type: "tts",
        reason: error instanceof Error ? error.message : "create_failed",
      });
      await noteFailure(job);
    }
  }
}

async function startVideos(
  pending: CeremonyJobRow[],
  jobs: CeremonyJobRow[],
  client: MagicHourClient,
  ceremonyId: string,
  sessionId: string,
  slots: number,
) {
  if (slots <= 0) return;
  const db = getWorkerDb();
  const memberRows = await db.query.members.findMany({ where: eq(members.sessionId, sessionId) });
  let remaining = slots;
  for (const job of pending) {
    if (remaining <= 0 || !job.lineId) break;
    try {
      if (job.type === "ttv") {
        const prompt = job.lineId === "intro" ? TTV_INTRO_PROMPT : TTV_OUTRO_PROMPT;
        const created = await client.createTextToVideo({ lineId: job.lineId, prompt });
        await addCredits(ceremonyId, created.credits);
        await db
          .update(ceremonyJobs)
          .set({ externalId: created.projectId, status: "running" })
          .where(eq(ceremonyJobs.id, job.id));
        remaining -= 1;
        continue;
      }
      if (job.type !== "talking_photo" || !job.memberExportKey) continue;
      const audio = jobs.find((row) => row.type === "tts" && row.lineId === job.lineId && row.objectKey);
      const member = memberRows.find((row) => row.exportKey === job.memberExportKey);
      if (!audio?.objectKey || !member?.avatarObjectKey) continue;
      const image = await magicHourAssetRef(client, member.avatarObjectKey, "image", "png");
      const audioAsset = await magicHourAssetRef(client, audio.objectKey, "audio", "wav");
      const created = await client.createTalkingPhoto({
        lineId: job.lineId,
        imageUrl: image.ref,
        audioUrl: audioAsset.ref,
        ...(audioAsset.endSeconds ? { endSeconds: audioAsset.endSeconds } : {}),
      });
      await addCredits(ceremonyId, created.credits);
      await db
        .update(ceremonyJobs)
        .set({ externalId: created.projectId, status: "running" })
        .where(eq(ceremonyJobs.id, job.id));
      remaining -= 1;
    } catch (error) {
      if (error instanceof InsufficientCreditsError) throw error;
      logCeremony("ceremony_clip_create_failed", {
        lineId: job.lineId,
        type: job.type,
        reason: error instanceof Error ? error.message : "create_failed",
      });
      await noteFailure(job);
    }
  }
}

async function renderPendingCards(jobs: CeremonyJobRow[], sessionId: string) {
  const db = getWorkerDb();
  const store = createObjectStore();
  for (const job of jobs) {
    if (job.type !== "card" || job.status === "complete" || !job.scriptText || !job.lineId) continue;
    const card = await renderSpeedRoundCard(job.scriptText);
    const key = `sessions/${sessionId}/clips/${job.lineId}.mp4`;
    await store.put(key, card);
    await db.update(ceremonyJobs).set({ status: "complete", objectKey: key }).where(eq(ceremonyJobs.id, job.id));
  }
}

async function bufferFor(key: string | null): Promise<Buffer> {
  if (!key) throw new Error("missing_clip");
  const bytes = await createObjectStore().get(key);
  if (!bytes) throw new Error("missing_clip");
  return bytes;
}

async function concatFromJobs(ceremonyId: string, sessionId: string, jobs: CeremonyJobRow[], lines: ScriptLine[]) {
  const db = getWorkerDb();
  const store = createObjectStore();
  await setCeremonyStatus(ceremonyId, "concatenating");
  const buffers: Buffer[] = [];
  for (const line of lines) {
    if (line.id === "intro" || line.id === "outro") {
      const job = jobs.find((row) => row.type === "ttv" && row.lineId === line.id);
      buffers.push(await bufferFor(job?.objectKey ?? null));
    } else if (line.id === "speed_round") {
      const job = jobs.find((row) => row.type === "card" && row.lineId === "speed_round");
      buffers.push(await bufferFor(job?.objectKey ?? null));
    } else if (line.memberId) {
      const job = jobs.find((row) => row.type === "talking_photo" && row.lineId === line.id);
      buffers.push(await bufferFor(job?.objectKey ?? null));
    }
  }
  const assembled = await concatVideoBuffers(buffers);
  await setCeremonyStatus(ceremonyId, "uploading");
  const videoKey = `sessions/${sessionId}/final.mp4`;
  await store.put(videoKey, assembled.mp4);
  const completedAt = new Date();
  await db
    .update(ceremonies)
    .set({
      status: "complete",
      videoObjectKey: videoKey,
      durationSec: assembled.durationSec,
      fallbackUsed: false,
      completedAt,
      videoExpiresAt: videoExpiry(completedAt),
    })
    .where(eq(ceremonies.id, ceremonyId));
  await db.update(sessions).set({ status: "complete" }).where(eq(sessions.id, sessionId));
  const concatJob = jobs.find((row) => row.type === "concat");
  if (concatJob) {
    await db.update(ceremonyJobs).set({ status: "complete", objectKey: videoKey }).where(eq(ceremonyJobs.id, concatJob.id));
  }
}

async function advanceMagicHour(ceremonyId: string, sessionId: string, client: MagicHourClient): Promise<"continue" | "complete"> {
  let jobs = await loadJobs(ceremonyId);
  const ttsJobs = () => jobs.filter((job) => job.type === "tts");
  const ttsReady = () => ttsJobs().every((job) => job.status === "complete" && job.objectKey);
  if (!ttsReady()) {
    await setCeremonyStatus(ceremonyId, "tts_batch");
    await pollJobs(
      ttsJobs().filter((job) => job.status === "running"),
      client,
      sessionId,
      "audio",
    );
    jobs = await loadJobs(ceremonyId);
    if (!ttsReady()) {
      await startTts(
        ttsJobs().filter((job) => job.status === "pending"),
        client,
        ceremonyId,
      );
      return "continue";
    }
  }

  await setCeremonyStatus(ceremonyId, "mh_clips_running");
  await ensureInitials(sessionId);
  await renderPendingCards(jobs, sessionId);
  jobs = await loadJobs(ceremonyId);
  const videos = () => jobs.filter((job) => job.type === "ttv" || job.type === "talking_photo");
  await pollJobs(
    videos().filter((job) => job.status === "running"),
    client,
    sessionId,
    "video",
  );
  jobs = await loadJobs(ceremonyId);
  const running = videos().filter((job) => job.status === "running").length;
  await startVideos(
    videos().filter((job) => job.status === "pending"),
    jobs,
    client,
    ceremonyId,
    sessionId,
    MAX_VIDEO_IN_FLIGHT - running,
  );
  jobs = await loadJobs(ceremonyId);
  const cardsDone = jobs.filter((job) => job.type === "card").every((job) => job.status === "complete" && job.objectKey);
  const videosDone = videos().every((job) => job.status === "complete" && job.objectKey);
  if (!cardsDone || !videosDone) return "continue";
  const { script } = await loadCeremonyContext(sessionId);
  await concatFromJobs(ceremonyId, sessionId, jobs, script.lines);
  return "complete";
}

export async function seedCeremonyJobs(ceremonyId: string, sessionId: string): Promise<void> {
  const db = getWorkerDb();
  const existing = await db.query.ceremonyJobs.findMany({ where: eq(ceremonyJobs.ceremonyId, ceremonyId) });
  if (existing.length > 0) return;

  const { script } = await loadCeremonyContext(sessionId);
  for (const line of script.lines) {
    const text = sanitizeLine(line.text);
    if (line.memberId && line.awardId) {
      await db.insert(ceremonyJobs).values({
        ceremonyId,
        type: "tts",
        lineId: line.id,
        status: "pending",
        scriptText: text,
      });
    }
    if (line.id === "intro" || line.id === "outro") {
      await db.insert(ceremonyJobs).values({
        ceremonyId,
        type: "ttv",
        lineId: line.id,
        status: "pending",
      });
    }
    if (line.memberId && line.awardId) {
      await db.insert(ceremonyJobs).values({
        ceremonyId,
        type: "talking_photo",
        lineId: line.id,
        status: "pending",
        memberExportKey: line.memberId,
      });
    }
    if (line.id === "speed_round") {
      await db.insert(ceremonyJobs).values({
        ceremonyId,
        type: "card",
        lineId: "speed_round",
        status: "pending",
        scriptText: text,
      });
    }
  }
  await db.insert(ceremonyJobs).values({
    ceremonyId,
    type: "concat",
    lineId: "final",
    status: "pending",
  });
}

export async function processCeremony(ceremonyId: string): Promise<CeremonyTick> {
  const db = getWorkerDb();
  const ceremony = await db.query.ceremonies.findFirst({ where: eq(ceremonies.id, ceremonyId) });
  if (!ceremony) return "missing";
  if (ceremony.status === "complete" || ceremony.status === "failed") return ceremony.status;

  if (Date.now() - ceremony.createdAt.getTime() > CEREMONY_TIMEOUT_MS) {
    logCeremony("ceremony_fallback", { ceremonyId, reason: "timeout" });
    await runFallback(ceremonyId, ceremony.sessionId);
    return "complete";
  }

  await seedCeremonyJobs(ceremonyId, ceremony.sessionId);
  const client = resolveMagicHourClient();
  if (!client) {
    logCeremony("ceremony_fallback", { ceremonyId, reason: "magic_hour_unavailable" });
    await runFallback(ceremonyId, ceremony.sessionId);
    return "complete";
  }

  try {
    const result = await advanceMagicHour(ceremonyId, ceremony.sessionId, client);
    logCeremony("ceremony_tick", { ceremonyId, result });
    return result === "complete" ? "complete" : "continue";
  } catch (error) {
    if (shouldFallback(error)) {
      logCeremony("ceremony_fallback", {
        ceremonyId,
        reason: error instanceof Error ? error.message : "unknown",
      });
      await runFallback(ceremonyId, ceremony.sessionId);
      return "complete";
    }
    await db
      .update(ceremonies)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(ceremonies.id, ceremonyId));
    await db.update(sessions).set({ status: "failed" }).where(eq(sessions.id, ceremony.sessionId));
    return "failed";
  }
}

export async function markCeremonyJobComplete(externalId: string, downloadBytes?: Buffer): Promise<boolean> {
  const db = getWorkerDb();
  const job = await db.query.ceremonyJobs.findFirst({ where: eq(ceremonyJobs.externalId, externalId) });
  if (!job?.lineId || !downloadBytes) return false;

  const ceremony = await db.query.ceremonies.findFirst({ where: eq(ceremonies.id, job.ceremonyId) });
  if (!ceremony) return false;

  const store = createObjectStore();
  const key =
    job.type === "tts"
      ? `sessions/${ceremony.sessionId}/audio/${job.lineId}.mp3`
      : `sessions/${ceremony.sessionId}/clips/${job.lineId}.mp4`;
  await store.put(key, downloadBytes);
  await db.update(ceremonyJobs).set({ status: "complete", objectKey: key }).where(eq(ceremonyJobs.id, job.id));
  return true;
}
