import { describe, expect, it, vi } from "vitest";
import { requestUploadCore, uploadErrorMessage, type UploadDeps } from "./request-upload-core";

const input = { name: "recetas.pdf", size: 1_000_000, mime: "application/pdf" };

function makeDeps(over: Partial<UploadDeps> = {}): UploadDeps & { inserted: unknown[] } {
  const inserted: unknown[] = [];
  return {
    sellerId: "seller-1",
    newId: () => "11111111-1111-4111-8111-111111111111",
    hasActiveSubscription: vi.fn().mockResolvedValue(true),
    countActive: vi.fn().mockResolvedValue(0),
    insertUpload: vi.fn(async (row) => {
      inserted.push(row);
      return { ok: true } as const;
    }),
    createSignedUrl: vi.fn().mockResolvedValue({ signedUrl: "https://x/upload", token: "tok" }),
    inserted,
    ...over,
  };
}

describe("requestUploadCore (R11)", () => {
  it("records the upload under the seller path and returns a signed URL", async () => {
    const deps = makeDeps();
    const r = await requestUploadCore(input, deps);
    expect(r).toEqual({
      ok: true,
      uploadId: "11111111-1111-4111-8111-111111111111",
      path: "seller-1/11111111-1111-4111-8111-111111111111.pdf",
      signedUrl: "https://x/upload",
      token: "tok",
      activeCount: 1,
    });
    expect(deps.inserted[0]).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      seller_id: "seller-1",
      storage_path: "seller-1/11111111-1111-4111-8111-111111111111.pdf",
      original_name: "recetas.pdf",
      size_bytes: 1_000_000,
    });
  });

  it("requires an active subscription before counting, recording or signing anything (AI costs money)", async () => {
    const deps = makeDeps({ hasActiveSubscription: vi.fn().mockResolvedValue(false) });
    const r = await requestUploadCore(input, deps);
    expect(r).toMatchObject({ ok: false, reason: "subscription_required" });
    expect(deps.countActive).not.toHaveBeenCalled();
    expect(deps.insertUpload).not.toHaveBeenCalled();
    expect(deps.createSignedUrl).not.toHaveBeenCalled();
  });

  it("explains the subscription requirement in Spanish", () => {
    expect(uploadErrorMessage("subscription_required")).toMatch(/suscripci/i);
  });

  it("rejects the 13th upload in the app without touching the database", async () => {
    const deps = makeDeps({ countActive: vi.fn().mockResolvedValue(12) });
    const r = await requestUploadCore(input, deps);
    expect(r).toMatchObject({ ok: false, reason: "limit_reached" });
    expect(deps.insertUpload).not.toHaveBeenCalled();
    expect(deps.createSignedUrl).not.toHaveBeenCalled();
  });

  it("accepts the 12th upload", async () => {
    const r = await requestUploadCore(input, makeDeps({ countActive: vi.fn().mockResolvedValue(11) }));
    expect(r.ok).toBe(true);
  });

  it.each([
    [{ ...input, mime: "image/png", name: "a.png" }, "not_pdf"],
    [{ ...input, size: 21 * 1024 * 1024 }, "too_large"],
    [{ ...input, size: 0 }, "empty"],
  ])("rejects %j as %s and stores nothing", async (bad, reason) => {
    const deps = makeDeps();
    const r = await requestUploadCore(bad, deps);
    expect(r).toMatchObject({ ok: false, reason });
    expect(deps.insertUpload).not.toHaveBeenCalled();
    expect(deps.createSignedUrl).not.toHaveBeenCalled();
  });

  it("maps the database trigger rejection (race) to limit_reached", async () => {
    const deps = makeDeps({ insertUpload: vi.fn().mockResolvedValue({ ok: false, limit: true }) });
    expect(await requestUploadCore(input, deps)).toMatchObject({ ok: false, reason: "limit_reached" });
    expect(deps.createSignedUrl).not.toHaveBeenCalled();
  });

  it("reports an unexpected insert failure without a signed URL", async () => {
    const deps = makeDeps({ insertUpload: vi.fn().mockResolvedValue({ ok: false, limit: false }) });
    expect(await requestUploadCore(input, deps)).toMatchObject({ ok: false, reason: "failed" });
  });

  it("strips directories and caps the stored original name", async () => {
    const deps = makeDeps();
    await requestUploadCore({ ...input, name: `C:\\fakepath\\${"a".repeat(300)}.pdf` }, deps);
    const stored = (deps.inserted[0] as { original_name: string }).original_name;
    expect(stored.includes("\\")).toBe(false);
    expect(stored.length).toBeLessThanOrEqual(200);
    expect(stored.endsWith(".pdf")).toBe(true);
  });
});

describe("uploadErrorMessage", () => {
  it("has neutral Spanish copy for every reason", () => {
    for (const reason of ["limit_reached", "not_pdf", "empty", "too_large", "failed"] as const) {
      expect(uploadErrorMessage(reason).length).toBeGreaterThan(10);
    }
    expect(uploadErrorMessage("limit_reached")).toMatch(/12/);
  });
});
