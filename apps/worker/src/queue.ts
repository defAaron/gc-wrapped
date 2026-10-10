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

export async function enqueueCeremony(ceremonyId: string): Promise<void> {
  if (process.env.CEREMONY_INLINE === "1" || process.env.VITEST === "true") {
    await processCeremony(ceremonyId);
    return;
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
      await processCeremony(job.data.ceremonyId);
    },
    { connection: getRedisConnection(), concurrency: 1 },
  );
  return worker;
}
