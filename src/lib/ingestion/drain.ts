import type { IngestionJob, ProcessJobResult } from "./process-job";

export type DrainDeps = {
  /** Atomically claims the next runnable job, or null when none is due. */
  claim(): Promise<IngestionJob | null>;
  run(job: IngestionJob): Promise<ProcessJobResult>;
  now(): number;
};

export type DrainSummary = { processed: number; succeeded: number; retried: number; failed: number };

/** Drains the queue sequentially, bounded by job count and a wall-clock budget. */
export async function drainQueue(deps: DrainDeps, opts: { maxJobs: number; budgetMs: number }): Promise<DrainSummary> {
  const summary: DrainSummary = { processed: 0, succeeded: 0, retried: 0, failed: 0 };
  const startedAt = deps.now();

  while (summary.processed < opts.maxJobs && deps.now() - startedAt < opts.budgetMs) {
    const job = await deps.claim();
    if (!job) break;
    const result = await deps.run(job);
    summary.processed++;
    if (result.outcome === "succeeded") summary.succeeded++;
    else if (result.outcome === "retry") summary.retried++;
    else summary.failed++;
  }
  return summary;
}
