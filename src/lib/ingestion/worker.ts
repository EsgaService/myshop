import "server-only";
import { getAiBookProvider } from "@/lib/ai";
import { drainQueue, type DrainSummary } from "./drain";
import { processJob } from "./process-job";
import { claimNextJob, createIngestionRepo } from "./repo";
import { downloadPdfBase64 } from "./storage";

const DEFAULT_MAX_JOBS = 5;
/** Leaves headroom under the route maxDuration (300s) for the job in flight. */
const DEFAULT_BUDGET_MS = 200_000;

/**
 * In-process queue worker. Kicked from `after()` when an upload is confirmed,
 * by the status poll when a job sits queued, and by /api/ingestion/run.
 * Safe to run concurrently: claiming uses FOR UPDATE SKIP LOCKED.
 */
export async function runIngestionWorker(
  opts: { maxJobs?: number; budgetMs?: number } = {},
): Promise<DrainSummary> {
  const repo = createIngestionRepo();
  const ai = getAiBookProvider();
  const storage = { downloadBase64: downloadPdfBase64 };

  return drainQueue(
    {
      claim: claimNextJob,
      run: (job) => processJob(job, { repo, storage, ai, now: () => new Date() }),
      now: () => Date.now(),
    },
    { maxJobs: opts.maxJobs ?? DEFAULT_MAX_JOBS, budgetMs: opts.budgetMs ?? DEFAULT_BUDGET_MS },
  );
}
