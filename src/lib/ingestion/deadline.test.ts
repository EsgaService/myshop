import { describe, expect, it } from "vitest";
import { ROUTE_DEADLINE_MS, jobTimeoutMs } from "./deadline";

describe("jobTimeoutMs", () => {
  it("caps a job at the per-call timeout when plenty of time remains", () => {
    expect(jobTimeoutMs({ startedAt: 0, now: 0 })).toBe(180_000);
  });
  it("never lets a job outlive the route deadline (maxDuration 300s)", () => {
    expect(ROUTE_DEADLINE_MS).toBeLessThan(300_000);
    const now = 199_000;
    const timeout = jobTimeoutMs({ startedAt: 0, now });
    expect(now + timeout).toBeLessThanOrEqual(ROUTE_DEADLINE_MS);
  });
  it("keeps a small positive floor once the deadline has passed", () => {
    expect(jobTimeoutMs({ startedAt: 0, now: 400_000 })).toBeGreaterThan(0);
  });
});
