import { describe, expect, it } from "vitest";
import { classifyMoveRpcError, decideMoveUpload, moveUploadErrorMessage } from "./decide-move-upload";

const base = {
  uploadStatus: "ready" as const,
  uploadRemoved: false,
  sourceId: "source",
  sourceStatus: "draft" as const,
  sourceIsLegacy: false,
  targetId: "target",
  targetIsLegacy: false,
  targetIsArchived: false,
  otherReadyCount: 1,
};

describe("decideMoveUpload", () => {
  it("allows moving a ready PDF into another product", () => {
    expect(decideMoveUpload(base)).toEqual({ ok: true });
  });

  it("allows moving the only ready PDF of a draft source", () => {
    expect(decideMoveUpload({ ...base, otherReadyCount: 0 })).toEqual({ ok: true });
  });

  it("allows moving out of a published source when another ready PDF remains", () => {
    expect(decideMoveUpload({ ...base, sourceStatus: "published" })).toEqual({ ok: true });
  });

  it.each(["pending", "uploaded", "processing", "failed"] as const)("refuses a %s PDF", (uploadStatus) => {
    expect(decideMoveUpload({ ...base, uploadStatus })).toEqual({ ok: false, reason: "not_ready" });
  });

  it("refuses a removed PDF", () => {
    expect(decideMoveUpload({ ...base, uploadRemoved: true })).toEqual({ ok: false, reason: "not_ready" });
  });

  it("refuses moving into the same product", () => {
    expect(decideMoveUpload({ ...base, targetId: "source" })).toEqual({ ok: false, reason: "same_product" });
  });

  it("refuses a legacy target", () => {
    expect(decideMoveUpload({ ...base, targetIsLegacy: true })).toEqual({ ok: false, reason: "invalid_target" });
  });

  it("refuses an archived target", () => {
    expect(decideMoveUpload({ ...base, targetIsArchived: true })).toEqual({ ok: false, reason: "invalid_target" });
  });

  it("refuses a legacy source", () => {
    expect(decideMoveUpload({ ...base, sourceIsLegacy: true })).toEqual({ ok: false, reason: "invalid_target" });
  });

  it("refuses the last ready PDF of a published source", () => {
    expect(decideMoveUpload({ ...base, sourceStatus: "published", otherReadyCount: 0 })).toEqual({
      ok: false,
      reason: "last_ready_pdf",
    });
  });

  it("reports not_ready before the other reasons", () => {
    expect(
      decideMoveUpload({ ...base, uploadStatus: "failed", targetIsLegacy: true, sourceStatus: "published", otherReadyCount: 0 }),
    ).toEqual({ ok: false, reason: "not_ready" });
  });
});

describe("moveUploadErrorMessage", () => {
  it("returns distinct Spanish copy per reason", () => {
    expect(moveUploadErrorMessage("not_ready")).toMatch(/listo/i);
    expect(moveUploadErrorMessage("same_product")).toMatch(/otro producto/i);
    expect(moveUploadErrorMessage("invalid_target")).toMatch(/destino/i);
    expect(moveUploadErrorMessage("last_ready_pdf")).toMatch(/único PDF/);
    expect(moveUploadErrorMessage("rpc_missing")).toBe("Mover PDFs todavía no está disponible. Inténtalo más tarde.");
  });
});

describe("classifyMoveRpcError", () => {
  it("maps the guards raised by the RPC", () => {
    expect(classifyMoveRpcError({ code: "P0001", message: "last_ready_pdf" })).toBe("last_ready_pdf");
    expect(classifyMoveRpcError({ code: "P0001", message: "upload_not_ready" })).toBe("not_ready");
    expect(classifyMoveRpcError({ code: "P0001", message: "invalid_target" })).toBe("invalid_target");
  });

  it("maps a missing RPC (PGRST202 / 42883)", () => {
    expect(classifyMoveRpcError({ code: "PGRST202", message: "Could not find the function" })).toBe("rpc_missing");
    expect(classifyMoveRpcError({ code: "42883", message: "function does not exist" })).toBe("rpc_missing");
  });

  it("maps ownership failures to not_found and everything else to unknown", () => {
    expect(classifyMoveRpcError({ code: "P0001", message: "upload_not_owned" })).toBe("not_found");
    expect(classifyMoveRpcError({ code: "XX000", message: "boom" })).toBe("unknown");
    expect(classifyMoveRpcError({})).toBe("unknown");
  });
});
