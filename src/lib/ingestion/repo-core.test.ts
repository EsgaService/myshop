import { describe, expect, it } from "vitest";
import { createIngestionRepoCore, type AdminLike } from "./repo-core";

type Call = { table: string; op: string; payload?: unknown; filters: [string, unknown][] };

/** Minimal chainable stand-in for the supabase-js query builder; resolves to `result`. */
function fakeAdmin(result: { data: unknown; error: { message: string } | null }) {
  const calls: Call[] = [];
  const admin = {
    from(table: string) {
      const call: Call = { table, op: "", filters: [] };
      calls.push(call);
      const builder: Record<string, unknown> = {
        update(payload: unknown) {
          call.op = "update";
          call.payload = payload;
          return builder;
        },
        eq(column: string, value: unknown) {
          call.filters.push([column, value]);
          return builder;
        },
        select() {
          return builder;
        },
        then(resolve: (v: unknown) => unknown) {
          return Promise.resolve(result).then(resolve);
        },
      };
      return builder;
    },
  };
  return { admin: admin as unknown as AdminLike, calls };
}

const job = { id: "job1", upload_id: "up1", attempts: 2, max_attempts: 3 };

describe("ingestion repo ownership guards", () => {
  it("markRetry only touches the job while it is still the claimed attempt", async () => {
    const { admin, calls } = fakeAdmin({ data: [{ id: "job1" }], error: null });
    await createIngestionRepoCore(admin).markRetry(job, new Date("2026-10-12T10:00:00Z"), "boom");

    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("ingestion_jobs");
    expect(calls[0].filters).toEqual(
      expect.arrayContaining([
        ["id", "job1"],
        ["status", "processing"],
        ["attempts", 2],
      ]),
    );
  });

  it("markFailed guards the job update the same way and then fails the upload", async () => {
    const { admin, calls } = fakeAdmin({ data: [{ id: "job1" }], error: null });
    await createIngestionRepoCore(admin).markFailed(job, "boom");

    const jobCall = calls.find((c) => c.table === "ingestion_jobs")!;
    expect(jobCall.filters).toEqual(
      expect.arrayContaining([
        ["id", "job1"],
        ["status", "processing"],
        ["attempts", 2],
      ]),
    );
    expect(calls.some((c) => c.table === "book_uploads")).toBe(true);
  });

  it("markFailed leaves the upload alone when the job was reclaimed by another worker", async () => {
    const { admin, calls } = fakeAdmin({ data: [], error: null });
    await createIngestionRepoCore(admin).markFailed(job, "boom");

    expect(calls.every((c) => c.table === "ingestion_jobs")).toBe(true);
  });

  it("surfaces database errors", async () => {
    const { admin } = fakeAdmin({ data: null, error: { message: "db down" } });
    await expect(createIngestionRepoCore(admin).markRetry(job, new Date(), "x")).rejects.toThrow(/db down/);
  });
});
