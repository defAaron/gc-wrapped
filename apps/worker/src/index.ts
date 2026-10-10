import { startCeremonyWorker } from "./queue";

const worker = startCeremonyWorker();
worker.on("failed", (_job, error) => {
  console.error("ceremony_job_failed", { message: error.message });
});

console.log("ceremony worker listening");
