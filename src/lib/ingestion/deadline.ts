/** Route maxDuration is 300s; leave headroom to persist the outcome after the AI call. */
export const ROUTE_DEADLINE_MS = 280_000;
const CALL_TIMEOUT_MS = 180_000;
const MIN_TIMEOUT_MS = 1_000;

/**
 * Time a single job may run: the per-call cap, shrunk so that `now + timeout` never passes the
 * route deadline measured from `startedAt`. Keeps a small floor so the abort signal is valid.
 */
export function jobTimeoutMs({ startedAt, now }: { startedAt: number; now: number }): number {
  const remaining = startedAt + ROUTE_DEADLINE_MS - now;
  return Math.max(MIN_TIMEOUT_MS, Math.min(CALL_TIMEOUT_MS, remaining));
}
