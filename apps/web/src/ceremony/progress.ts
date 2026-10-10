import { desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { ceremonies, ceremonyJobs } from "../db/schema";
import type { CeremonyStatus } from "@kudos/shared";

export async function getCeremonyProgress(sessionId: string): Promise<{
  ceremonyId: string | null;
  status: "rendering" | "complete" | "failed" | null;
  stage: CeremonyStatus | null;
  progress: number;
  fallbackUsed: boolean;
  videoObjectKey: string | null;
}> {
  const db = getDb();
  const ceremonyRows = await db
    .select()
    .from(ceremonies)
    .where(eq(ceremonies.sessionId, sessionId))
    .orderBy(desc(ceremonies.createdAt))
    .limit(1);
  const ceremony = ceremonyRows[0];
  if (!ceremony) {
    return {
      ceremonyId: null,
      status: null,
      stage: null,
      progress: 0,
      fallbackUsed: false,
      videoObjectKey: null,
    };
  }

  const jobs = await db.query.ceremonyJobs.findMany({ where: eq(ceremonyJobs.ceremonyId, ceremony.id) });
  const total = jobs.length;
  const complete = jobs.filter((job) => job.status === "complete").length;
  const progress = total > 0 ? complete / total : ceremony.status === "complete" ? 1 : 0;

  let status: "rendering" | "complete" | "failed";
  if (ceremony.status === "complete") status = "complete";
  else if (ceremony.status === "failed") status = "failed";
  else status = "rendering";

  return {
    ceremonyId: ceremony.id,
    status,
    stage: ceremony.status as CeremonyStatus,
    progress,
    fallbackUsed: ceremony.fallbackUsed,
    videoObjectKey: ceremony.videoObjectKey,
  };
}
