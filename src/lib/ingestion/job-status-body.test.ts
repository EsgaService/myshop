import { describe, expect, it } from "vitest";
import { buildJobStatusBody } from "./job-status-body";

const job = {
  id: "job-1",
  status: "succeeded" as const,
  attempts: 1,
  max_attempts: 3,
  last_error: "stale error",
};

describe("buildJobStatusBody (R6.2)", () => {
  it("exposes the owning product id and marks a ready upload as ingested", () => {
    expect(buildJobStatusBody(job, { status: "ready", book_id: "book-1" })).toEqual({
      id: "job-1",
      status: "succeeded",
      uploadStatus: "ready",
      attempts: 1,
      maxAttempts: 3,
      error: null,
      bookId: "book-1",
      ingested: true,
    });
  });

  it("does not treat an upload as ingested just because it already has a product", () => {
    const body = buildJobStatusBody({ ...job, status: "queued" }, { status: "uploaded", book_id: "book-1" });
    expect(body.bookId).toBe("book-1");
    expect(body.ingested).toBe(false);
  });

  it("surfaces the error only for failed jobs", () => {
    expect(buildJobStatusBody({ ...job, status: "failed" }, { status: "failed", book_id: "book-1" }).error).toBe("stale error");
    expect(buildJobStatusBody({ ...job, status: "processing" }, { status: "processing", book_id: "book-1" }).error).toBeNull();
  });
});
