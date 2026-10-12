import { describe, expect, it } from "vitest";
import { MAX_PDF_BYTES, MAX_UPLOADS_PER_SELLER, UPLOAD_TOKEN_TTL_MS, checkUpload, holdsUploadSlot } from "./upload-limit";

const ok = { activeCount: 0, size: 1024, mime: "application/pdf", name: "recetas.pdf" };

describe("checkUpload (R11)", () => {
  it("has the documented caps", () => {
    expect(MAX_UPLOADS_PER_SELLER).toBe(12);
    expect(MAX_PDF_BYTES).toBe(20 * 1024 * 1024);
  });

  it("accepts a valid PDF", () => {
    expect(checkUpload(ok)).toEqual({ ok: true });
  });

  it("accepts the 12th upload and rejects the 13th", () => {
    expect(checkUpload({ ...ok, activeCount: 11 })).toEqual({ ok: true });
    expect(checkUpload({ ...ok, activeCount: 12 })).toEqual({ ok: false, reason: "limit_reached" });
    expect(checkUpload({ ...ok, activeCount: 20 })).toEqual({ ok: false, reason: "limit_reached" });
  });

  it("rejects non-PDF mime types or names", () => {
    expect(checkUpload({ ...ok, mime: "image/png" })).toEqual({ ok: false, reason: "not_pdf" });
    expect(checkUpload({ ...ok, mime: "application/pdf", name: "virus.exe" })).toEqual({ ok: false, reason: "not_pdf" });
    expect(checkUpload({ ...ok, mime: "" })).toEqual({ ok: false, reason: "not_pdf" });
  });

  it("accepts an uppercase extension", () => {
    expect(checkUpload({ ...ok, name: "RECETAS.PDF" })).toEqual({ ok: true });
  });

  it("rejects empty and oversize files, accepting exactly the cap", () => {
    expect(checkUpload({ ...ok, size: 0 })).toEqual({ ok: false, reason: "empty" });
    expect(checkUpload({ ...ok, size: MAX_PDF_BYTES })).toEqual({ ok: true });
    expect(checkUpload({ ...ok, size: MAX_PDF_BYTES + 1 })).toEqual({ ok: false, reason: "too_large" });
  });

  it("rejects non-finite sizes", () => {
    expect(checkUpload({ ...ok, size: Number.NaN })).toEqual({ ok: false, reason: "empty" });
  });
});

describe("holdsUploadSlot (removal must not free a slot while the signed upload token is usable)", () => {
  const now = new Date("2026-10-12T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it("has a 2 hour token window", () => {
    expect(UPLOAD_TOKEN_TTL_MS).toBe(2 * 60 * 60 * 1000);
  });

  it("holds a slot for every active upload", () => {
    for (const status of ["pending", "uploaded", "processing", "ready", "failed"] as const) {
      expect(holdsUploadSlot({ status, removed_at: null }, now)).toBe(true);
    }
  });

  it("keeps the slot of a removed PENDING upload until its token expires", () => {
    expect(holdsUploadSlot({ status: "pending", removed_at: ago(60_000) }, now)).toBe(true);
    expect(holdsUploadSlot({ status: "pending", removed_at: ago(UPLOAD_TOKEN_TTL_MS - 1) }, now)).toBe(true);
    expect(holdsUploadSlot({ status: "pending", removed_at: ago(UPLOAD_TOKEN_TTL_MS) }, now)).toBe(false);
    expect(holdsUploadSlot({ status: "pending", removed_at: ago(UPLOAD_TOKEN_TTL_MS + 1) }, now)).toBe(false);
  });

  it("frees the slot at once for removed uploads whose token was already used", () => {
    for (const status of ["uploaded", "processing", "ready", "failed"] as const) {
      expect(holdsUploadSlot({ status, removed_at: ago(1_000) }, now)).toBe(false);
    }
  });
});
