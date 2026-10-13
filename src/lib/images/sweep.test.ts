import { describe, expect, it } from "vitest";
import { MAX_UPLOADS_PER_SWEEP, MIN_BUDGET_MS, SAFETY_MARGIN_MS, sweepImageExtraction } from "./sweep";
import type { UploadToProcess } from "./ports";
import type { ExtractionResult } from "./extract-upload-images";

const upload = (n: number): UploadToProcess => ({ id: `up-${n}`, sellerId: "s", bookId: "b", storagePath: `s/up-${n}.pdf` });

function makeDeps(queue: UploadToProcess[], results: ExtractionResult[] = [], stepMs = 0) {
  let clock = 0;
  const ran: { id: string; timeoutMs: number }[] = [];
  let claims = 0;
  return {
    ran,
    claims: () => claims,
    deps: {
      async claim() {
        claims++;
        return queue.shift() ?? null;
      },
      async run(u: UploadToProcess, timeoutMs: number) {
        ran.push({ id: u.id, timeoutMs });
        clock += stepMs;
        return results[ran.length - 1] ?? ({ status: "done", stored: 1 } as ExtractionResult);
      },
      now: () => clock,
    },
  };
}

describe("sweepImageExtraction (R1.2, R1.3)", () => {
  it("is skipped, without claiming anything, when less than 60 s remain", async () => {
    expect(MIN_BUDGET_MS).toBe(60_000);
    const w = makeDeps([upload(1)]);
    const summary = await sweepImageExtraction(w.deps, { remainingMs: 59_999 });
    expect(summary).toEqual({ skipped: true, processed: 0, done: 0, failed: 0 });
    expect(w.claims()).toBe(0);
    expect(w.ran).toEqual([]);
  });

  it("processes pending uploads (backfill) and counts done and failed", async () => {
    const w = makeDeps([upload(1), upload(2)], [
      { status: "done", stored: 4 },
      { status: "failed", error: "boom" },
    ]);
    const summary = await sweepImageExtraction(w.deps, { remainingMs: 120_000 });
    expect(summary).toEqual({ skipped: false, processed: 2, done: 1, failed: 1 });
    expect(w.ran.map((r) => r.id)).toEqual(["up-1", "up-2"]);
  });

  it("stops when the queue is empty", async () => {
    const w = makeDeps([]);
    const summary = await sweepImageExtraction(w.deps, { remainingMs: 120_000 });
    expect(summary).toEqual({ skipped: false, processed: 0, done: 0, failed: 0 });
    expect(w.claims()).toBe(1);
  });

  it("processes at most 3 uploads per sweep", async () => {
    expect(MAX_UPLOADS_PER_SWEEP).toBe(3);
    const w = makeDeps([upload(1), upload(2), upload(3), upload(4), upload(5)]);
    const summary = await sweepImageExtraction(w.deps, { remainingMs: 10 * 60_000 });
    expect(summary.processed).toBe(3);
    expect(w.ran.map((r) => r.id)).toEqual(["up-1", "up-2", "up-3"]);
  });

  it("gives each upload the remaining time minus the safety margin", async () => {
    const w = makeDeps([upload(1)]);
    await sweepImageExtraction(w.deps, { remainingMs: 100_000 });
    expect(w.ran[0].timeoutMs).toBe(100_000 - SAFETY_MARGIN_MS);
  });

  it("stops claiming once the budget is spent", async () => {
    // 100 s remain, margin 30 s => 70 s usable. The first upload takes 50 s, so only 20 s are left (< 60 s min).
    const w = makeDeps([upload(1), upload(2)], [], 50_000);
    const summary = await sweepImageExtraction(w.deps, { remainingMs: 100_000 });
    expect(summary.processed).toBe(1);
    expect(w.ran.map((r) => r.id)).toEqual(["up-1"]);
  });
});
