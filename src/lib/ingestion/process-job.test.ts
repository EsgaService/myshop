import { describe, expect, it, vi } from "vitest";
import { AiProviderError } from "@/lib/ai/types";
import { processJob, retryDelayMs, type ProcessJobDeps } from "./process-job";

const now = new Date("2026-10-12T10:00:00Z");
const upload = { id: "up1", sellerId: "sel1", storagePath: "sel1/up1.pdf", originalName: "libro.pdf" };
const validBook = {
  title: "Libro",
  recipes: [{ title: "Receta", category: "Dulces", ingredients: ["1 taza de azúcar"], steps: ["Mezclar"] }],
};

function makeDeps(overrides: Partial<{ [K in keyof ProcessJobDeps]: Partial<ProcessJobDeps[K]> }> = {}) {
  const deps = {
    now: () => now,
    repo: {
      getUpload: vi.fn(async () => upload as typeof upload | null),
      createBook: vi.fn(async (_s: string, _u: string, _p: unknown) => "book1"),
      markRetry: vi.fn(async (_id: string, _runAfter: Date, _error: string) => {}),
      markFailed: vi.fn(async (_id: string, _uploadId: string, _error: string) => {}),
      ...overrides.repo,
    },
    storage: { downloadBase64: vi.fn(async (_path: string) => "QUJD"), ...overrides.storage },
    ai: { id: "mock" as const, extractBook: vi.fn(async (_i: unknown) => validBook as unknown), ...overrides.ai },
  };
  return deps as unknown as ProcessJobDeps & typeof deps;
}

const job = (attempts: number, max = 3) => ({ id: "job1", upload_id: "up1", attempts, max_attempts: max });

describe("processJob", () => {
  it("persists a validated draft book and reports success", async () => {
    const deps = makeDeps();
    const result = await processJob(job(1), deps);

    expect(result).toEqual({ outcome: "succeeded", bookId: "book1" });
    expect(deps.storage.downloadBase64).toHaveBeenCalledWith("sel1/up1.pdf");
    expect(deps.ai.extractBook).toHaveBeenCalledWith(expect.objectContaining({ pdfBase64: "QUJD", fileName: "libro.pdf" }));
    expect(deps.repo.createBook).toHaveBeenCalledTimes(1);
    const [seller, uploadId, payload] = (deps.repo.createBook as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(seller).toBe("sel1");
    expect(uploadId).toBe("up1");
    expect((payload as { slug: string }).slug).toBe("libro");
    expect(deps.repo.markRetry).not.toHaveBeenCalled();
    expect(deps.repo.markFailed).not.toHaveBeenCalled();
  });

  it("retries with linear backoff while attempts remain", async () => {
    const deps = makeDeps({ ai: { extractBook: vi.fn(async () => { throw new AiProviderError("timeout"); }) } });
    const result = await processJob(job(2), deps);

    expect(result.outcome).toBe("retry");
    const runAfter = new Date(now.getTime() + retryDelayMs(2));
    expect(result).toEqual({ outcome: "retry", runAfter });
    expect(deps.repo.markRetry).toHaveBeenCalledWith("job1", runAfter, "timeout");
    expect(deps.repo.createBook).not.toHaveBeenCalled();
  });

  it("fails for good when attempts are exhausted", async () => {
    const deps = makeDeps({ ai: { extractBook: vi.fn(async () => { throw new AiProviderError("timeout"); }) } });
    const result = await processJob(job(3, 3), deps);

    expect(result).toEqual({ outcome: "failed", error: "timeout" });
    expect(deps.repo.markFailed).toHaveBeenCalledWith("job1", "up1", "timeout");
    expect(deps.repo.markRetry).not.toHaveBeenCalled();
  });

  it("treats schema-invalid output as a failure without persisting anything (R13)", async () => {
    const deps = makeDeps({ ai: { extractBook: vi.fn(async () => ({ title: "x", recipes: [] })) } });
    const result = await processJob(job(3, 3), deps);

    expect(result.outcome).toBe("failed");
    expect(deps.repo.createBook).not.toHaveBeenCalled();
    expect(deps.repo.markFailed).toHaveBeenCalledTimes(1);
  });

  it("does not leak raw error details of unexpected failures", async () => {
    const deps = makeDeps({ storage: { downloadBase64: vi.fn(async () => { throw new Error("secret://internal-host"); }) } });
    const result = await processJob(job(3, 3), deps);

    expect(result.outcome).toBe("failed");
    expect((result as { error: string }).error).not.toContain("secret");
  });

  it("fails immediately when the upload no longer exists", async () => {
    const deps = makeDeps({ repo: { getUpload: vi.fn(async () => null) } });
    const result = await processJob(job(1), deps);

    expect(result.outcome).toBe("failed");
    expect(deps.repo.markFailed).toHaveBeenCalledTimes(1);
    expect(deps.ai.extractBook).not.toHaveBeenCalled();
  });

  it("retries when persisting fails transiently", async () => {
    const deps = makeDeps({ repo: { createBook: vi.fn(async () => { throw new Error("db down"); }) } });
    const result = await processJob(job(1), deps);
    expect(result.outcome).toBe("retry");
  });
});

describe("retryDelayMs", () => {
  it("is 30s per attempt", () => {
    expect(retryDelayMs(1)).toBe(30_000);
    expect(retryDelayMs(3)).toBe(90_000);
  });
});
