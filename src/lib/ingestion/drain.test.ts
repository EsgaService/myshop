import { describe, expect, it, vi } from "vitest";
import { drainQueue } from "./drain";

const job = (id: string) => ({ id, upload_id: `u-${id}`, attempts: 1, max_attempts: 3 });

describe("drainQueue", () => {
  it("processes claimed jobs until the queue is empty", async () => {
    const queue = [job("a"), job("b")];
    const claim = vi.fn(async () => queue.shift() ?? null);
    const run = vi.fn(async () => ({ outcome: "succeeded" as const, bookId: "x" }));

    const summary = await drainQueue({ claim, run, now: () => 0 }, { maxJobs: 10, budgetMs: 1000 });

    expect(run).toHaveBeenCalledTimes(2);
    expect(summary).toEqual({ processed: 2, succeeded: 2, retried: 0, failed: 0 });
  });

  it("counts retries and failures", async () => {
    const queue = [job("a"), job("b"), job("c")];
    const outcomes = [
      { outcome: "retry" as const, runAfter: new Date() },
      { outcome: "failed" as const, error: "x" },
      { outcome: "succeeded" as const, bookId: "b" },
    ];
    const summary = await drainQueue(
      { claim: async () => queue.shift() ?? null, run: async () => outcomes.shift()!, now: () => 0 },
      { maxJobs: 10, budgetMs: 1000 },
    );
    expect(summary).toEqual({ processed: 3, succeeded: 1, retried: 1, failed: 1 });
  });

  it("stops at maxJobs", async () => {
    const claim = vi.fn(async () => job("a"));
    const run = vi.fn(async () => ({ outcome: "succeeded" as const, bookId: "x" }));
    const summary = await drainQueue({ claim, run, now: () => 0 }, { maxJobs: 2, budgetMs: 1000 });
    expect(summary.processed).toBe(2);
  });

  it("stops claiming once the time budget is spent", async () => {
    let t = 0;
    const claim = vi.fn(async () => job("a"));
    const run = vi.fn(async () => {
      t += 600;
      return { outcome: "succeeded" as const, bookId: "x" };
    });
    const summary = await drainQueue({ claim, run, now: () => t }, { maxJobs: 10, budgetMs: 1000 });
    expect(summary.processed).toBe(2);
  });
});
