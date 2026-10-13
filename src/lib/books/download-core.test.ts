import { describe, expect, it, vi } from "vitest";
import { resolveDownload, type DownloadDeps } from "./download-core";

const BOOK = "00000000-0000-4000-8000-00000000b001";
const UPLOAD = "00000000-0000-4000-8000-00000000c001";

function deps(overrides: Partial<DownloadDeps> = {}): DownloadDeps {
  return {
    getUserId: async () => "user-1",
    loadUpload: async () => ({
      book_id: BOOK,
      seller_id: "seller-1",
      status: "ready",
      removed_at: null,
      original_name: "Mis recetas.pdf",
      storage_path: "seller-1/secret/file.pdf",
    }),
    isOwner: async () => false,
    hasPurchase: async () => true,
    createSignedUrl: async () => "https://storage.example/signed?token=abc",
    ...overrides,
  };
}

describe("resolveDownload (R3.1)", () => {
  it("redirects a purchaser to a 60 s signed URL with a safe download name", async () => {
    const createSignedUrl = vi.fn(async () => "https://storage.example/signed");
    const result = await resolveDownload(deps({ createSignedUrl }), { bookId: BOOK, uploadId: UPLOAD });
    expect(result).toEqual({ kind: "redirect", url: "https://storage.example/signed" });
    expect(createSignedUrl).toHaveBeenCalledWith("seller-1/secret/file.pdf", 60, "Mis recetas.pdf");
  });

  it("allows the owner seller without a purchase", async () => {
    const result = await resolveDownload(deps({ hasPurchase: async () => false, isOwner: async () => true }), {
      bookId: BOOK,
      uploadId: UPLOAD,
    });
    expect(result.kind).toBe("redirect");
  });

  it.each([
    ["malformed book id", { bookId: "nope", uploadId: UPLOAD }, {}],
    ["malformed upload id", { bookId: BOOK, uploadId: "nope" }, {}],
    ["anonymous", { bookId: BOOK, uploadId: UPLOAD }, { getUserId: async () => null }],
    ["unknown upload", { bookId: BOOK, uploadId: UPLOAD }, { loadUpload: async () => null }],
    ["neither owner nor purchaser", { bookId: BOOK, uploadId: UPLOAD }, { hasPurchase: async () => false }],
  ])("answers not_found for %s and never signs", async (_name, ids, override) => {
    const createSignedUrl = vi.fn(async () => "x");
    const result = await resolveDownload(deps({ ...override, createSignedUrl }), ids);
    expect(result).toEqual({ kind: "not_found" });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it.each([
    ["another book", { book_id: "00000000-0000-4000-8000-00000000b999" }],
    ["not ready", { status: "processing" }],
    ["removed", { removed_at: "2026-01-01T00:00:00Z" }],
  ])("answers not_found when the upload is %s", async (_name, patch) => {
    const result = await resolveDownload(
      deps({
        loadUpload: async () => ({
          book_id: BOOK,
          seller_id: "seller-1",
          status: "ready",
          removed_at: null,
          original_name: "a.pdf",
          storage_path: "p",
          ...patch,
        }),
      }),
      { bookId: BOOK, uploadId: UPLOAD },
    );
    expect(result).toEqual({ kind: "not_found" });
  });

  it("answers not_found when signing fails instead of leaking the error", async () => {
    const result = await resolveDownload(deps({ createSignedUrl: async () => null }), { bookId: BOOK, uploadId: UPLOAD });
    expect(result).toEqual({ kind: "not_found" });
  });
});
