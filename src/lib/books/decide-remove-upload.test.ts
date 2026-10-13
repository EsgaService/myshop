import { describe, expect, it } from "vitest";
import { classifyRemoveRpcError, decideRemoveUpload, removeUploadErrorMessage } from "./decide-remove-upload";

const base = {
  bookStatus: "draft" as const,
  uploadStatus: "ready" as const,
  jobStatus: "succeeded" as const,
  otherReadyCount: 1,
};

describe("decideRemoveUpload (R2.2, R2.3)", () => {
  it("allows removing a ready PDF when another ready PDF remains", () => {
    expect(decideRemoveUpload({ ...base, bookStatus: "published" })).toEqual({ ok: true });
  });

  it("allows removing the only ready PDF of a draft", () => {
    expect(decideRemoveUpload({ ...base, bookStatus: "draft", otherReadyCount: 0 })).toEqual({ ok: true });
  });

  it("refuses the last ready PDF of a published product", () => {
    expect(decideRemoveUpload({ ...base, bookStatus: "published", otherReadyCount: 0 })).toEqual({
      ok: false,
      reason: "last_ready_pdf",
    });
  });

  it("allows removing a failed PDF of a published product even without other ready PDFs", () => {
    expect(
      decideRemoveUpload({ bookStatus: "published", uploadStatus: "failed", jobStatus: "failed", otherReadyCount: 0 }),
    ).toEqual({ ok: true });
  });

  it("allows removing an incomplete upload that never got a job", () => {
    expect(
      decideRemoveUpload({ bookStatus: "draft", uploadStatus: "pending", jobStatus: null, otherReadyCount: 0 }),
    ).toEqual({ ok: true });
  });

  it.each([
    ["queued", "uploaded"],
    ["processing", "processing"],
  ] as const)("refuses while the job is %s", (jobStatus, uploadStatus) => {
    expect(decideRemoveUpload({ ...base, uploadStatus, jobStatus })).toEqual({ ok: false, reason: "processing" });
  });

  it("treats an uploaded file whose job row is not visible yet as processing", () => {
    expect(decideRemoveUpload({ ...base, uploadStatus: "uploaded", jobStatus: null })).toEqual({
      ok: false,
      reason: "processing",
    });
  });

  it("reports processing before the last-PDF guard", () => {
    expect(
      decideRemoveUpload({ bookStatus: "published", uploadStatus: "processing", jobStatus: "processing", otherReadyCount: 0 }),
    ).toEqual({ ok: false, reason: "processing" });
  });
});

describe("removeUploadErrorMessage", () => {
  it("returns distinct Spanish copy per reason", () => {
    expect(removeUploadErrorMessage("processing")).toMatch(/procesando/i);
    expect(removeUploadErrorMessage("last_ready_pdf")).toMatch(/único PDF/);
  });
});

describe("classifyRemoveRpcError", () => {
  it("maps the last-PDF guard raised by the RPC", () => {
    expect(classifyRemoveRpcError({ code: "P0001", message: "last_ready_pdf" })).toBe("last_ready_pdf");
  });

  it("maps a missing RPC (PostgREST PGRST202 or Postgres 42883) so the UI can explain it", () => {
    expect(classifyRemoveRpcError({ code: "PGRST202", message: "Could not find the function" })).toBe("rpc_missing");
    expect(classifyRemoveRpcError({ code: "42883", message: "function does not exist" })).toBe("rpc_missing");
  });

  it("maps ownership failures to not_found and everything else to unknown", () => {
    expect(classifyRemoveRpcError({ code: "P0001", message: "upload_not_owned" })).toBe("not_found");
    expect(classifyRemoveRpcError({ code: "XX000", message: "boom" })).toBe("unknown");
    expect(classifyRemoveRpcError({})).toBe("unknown");
  });

  it("has Spanish copy for the missing RPC", () => {
    expect(removeUploadErrorMessage("rpc_missing")).toMatch(/todavía no está disponible/);
  });
});
