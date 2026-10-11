import { Worker, Queue } from "bullmq";
import IORedis from "ioredis";
import { CEREMONY_QUEUE_NAME } from "@kudos/shared";
import { processCeremony } from "./process";

export type CeremonyJobPayload = { ceremonyId: string };

let sharedConnection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!sharedConnection) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    sharedConnection = new IORedis(url, { maxRetriesPerRequest: null });
  }
  return sharedConnection;
}

export function getCeremonyQueue(): Queue<CeremonyJobPayload> {
  return new Queue(CEREMONY_QUEUE_NAME, { connection: getRedisConnection() });
}

const CEREMONY_POLL_DELAY_MS = 30_000;

export async function enqueueCeremony(ceremonyId: string): Promise<void> {
  if (process.env.CEREMONY_INLINE === "1" || process.env.VITEST === "true") {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const result = await processCeremony(ceremonyId);
      if (result !== "continue") return;
    }
    throw new Error("ceremony_did_not_finish");
  }
  const queue = getCeremonyQueue();
  await queue.add(
    "run",
    { ceremonyId },
    { jobId: `ceremony-${ceremonyId}`, removeOnComplete: true, removeOnFail: false },
  );
}

export function startCeremonyWorker(): Worker<CeremonyJobPayload> {
  const worker = new Worker<CeremonyJobPayload>(
    CEREMONY_QUEUE_NAME,
    async (job) => {
      const result = await processCeremony(job.data.ceremonyId);
      if (result === "continue") {
        await getCeremonyQueue().add(
          "run",
          { ceremonyId: job.data.ceremonyId },
          {
            delay: CEREMONY_POLL_DELAY_MS,
            jobId: `ceremony-${job.data.ceremonyId}-${Date.now()}`,
            removeOnComplete: true,
            removeOnFail: false,
          },
        );
      }
    },
    { connection: getRedisConnection(), concurrency: 1 },
  );
  return worker;
}
