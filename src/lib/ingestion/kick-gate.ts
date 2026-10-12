/**
 * Throttle for status-poll driven worker kicks: at most one per window per process, so many
 * open tabs polling a stuck job cannot spawn a worker per request. The database also caps
 * concurrent running jobs (claim_ingestion_job); this is the cheap first gate.
 */
export function createKickGate(windowMs: number, now: () => number = Date.now) {
  let last = Number.NEGATIVE_INFINITY;
  return {
    tryAcquire(): boolean {
      const t = now();
      if (t - last < windowMs) return false;
      last = t;
      return true;
    },
  };
}
