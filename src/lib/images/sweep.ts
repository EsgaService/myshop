import type { ExtractionResult } from "./extract-upload-images";
import type { UploadToProcess } from "./ports";

/** The sweep only starts (or continues) with at least this much time left on the request. */
export const MIN_BUDGET_MS = 60_000;
/** Time kept free for the response after the last upload. */
export const SAFETY_MARGIN_MS = 30_000;
export const MAX_UPLOADS_PER_SWEEP = 3;

export type SweepDeps = {
  /** Atomically claims the next upload pending image extraction, or null. */
  claim(): Promise<UploadToProcess | null>;
  run(upload: UploadToProcess, timeoutMs: number): Promise<ExtractionResult>;
  now(): number;
};

export type SweepSummary = { skipped: boolean; processed: number; done: number; failed: number };

/**
 * Best-effort image extraction after the ingestion queue is drained (R1.2, R1.3). Skipped when under 60 s
 * of the request budget remain; processes up to 3 uploads, each limited to what is left minus a margin.
 */
export async function sweepImageExtraction(deps: SweepDeps, opts: { remainingMs: number }): Promise<SweepSummary> {
  const summary: SweepSummary = { skipped: false, processed: 0, done: 0, failed: 0 };
  if (opts.remainingMs < MIN_BUDGET_MS) return { ...summary, skipped: true };

  const startedAt = deps.now();
  while (summary.processed < MAX_UPLOADS_PER_SWEEP) {
    const left = opts.remainingMs - (deps.now() - startedAt);
    if (left < MIN_BUDGET_MS) break;
    const upload = await deps.claim();
    if (!upload) break;
    const result = await deps.run(upload, left - SAFETY_MARGIN_MS);
    summary.processed++;
    if (result.status === "done") summary.done++;
    else summary.failed++;
  }
  return summary;
}
