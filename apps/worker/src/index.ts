import { loadRootEnv } from "../../web/load-root-env";
import { createServer } from "node:http";

loadRootEnv();
import { sql } from "drizzle-orm";
import { RETENTION_SWEEP_MS } from "@kudos/shared";
import { runRetentionSweeps } from "../../web/src/retention/sessions";
import { getWorkerDb } from "./db";
import { getRedisConnection, startCeremonyWorker } from "./queue";

const worker = startCeremonyWorker();
worker.on("failed", (_job, error) => {
  console.error("ceremony_job_failed", { message: error.message });
});

async function healthy(): Promise<boolean> {
  try {
    const redis = await getRedisConnection().ping();
    if (redis !== "PONG") return false;
    const db = getWorkerDb();
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const port = Number(process.env.PORT ?? 8080);
createServer((request, response) => {
  if (request.url !== "/health") {
    response.statusCode = 404;
    response.end();
    return;
  }
  void healthy().then((ok) => {
    response.statusCode = ok ? 200 : 503;
    response.end(ok ? "ok" : "unhealthy");
  });
}).listen(port);

void runRetentionSweeps().catch((error: unknown) => {
  console.error("retention_sweep_failed", error instanceof Error ? error.message : "error");
});

setInterval(() => {
  void runRetentionSweeps().catch((error: unknown) => {
    console.error("retention_sweep_failed", error instanceof Error ? error.message : "error");
  });
}, RETENTION_SWEEP_MS);

console.log("ceremony worker listening");
