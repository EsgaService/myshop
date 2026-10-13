import "server-only";
import { getAiBookProvider } from "@/lib/ai";
import { runImageSweep } from "@/lib/images/run-sweep";
import { jobTimeoutMs, ROUTE_DEADLINE_MS } from "./deadline";
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

  const startedAt = Date.now();

  const summary = await drainQueue(
    {
      claim: claimNextJob,
      // Each job is aborted before the route maxDuration so a late call never outlives the request.
      run: (job) =>
        processJob(job, {
          repo,
          storage,
          ai,
          now: () => new Date(),
          signal: AbortSignal.timeout(jobTimeoutMs({ startedAt, now: Date.now() })),
        }),
      now: () => Date.now(),
    },
    { maxJobs: opts.maxJobs ?? DEFAULT_MAX_JOBS, budgetMs: opts.budgetMs ?? DEFAULT_BUDGET_MS },
  );

  // Best-effort image extraction (also backfills older uploads). It never throws and is skipped when
  // less than a minute of the request budget is left, so it cannot affect ingestion.
  await runImageSweep(ROUTE_DEADLINE_MS - (Date.now() - startedAt));
  return summary;
}
