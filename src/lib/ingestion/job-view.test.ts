import { describe, expect, it } from "vitest";
import { describeUpload, shouldKickWorker } from "./job-view";

const job = (status: "queued" | "processing" | "succeeded" | "failed") => ({ status, attempts: 1, max_attempts: 3 });

describe("describeUpload (R12)", () => {
  it("shows an unconfirmed upload as incomplete and removable, without polling", () => {
    expect(describeUpload({ uploadStatus: "pending", job: null })).toMatchObject({
      label: "Subida incompleta",
      polling: false,
      canRetry: false,
      canRemove: true,
    });
  });

  it("polls while queued or processing", () => {
    expect(describeUpload({ uploadStatus: "uploaded", job: job("queued") })).toMatchObject({ label: "En cola", polling: true, canRetry: false, canRemove: false });
    expect(describeUpload({ uploadStatus: "uploaded", job: job("processing") })).toMatchObject({ label: "Procesando con IA", polling: true });
  });

  it("stops polling on success and allows removal once settled (R2.1)", () => {
    expect(describeUpload({ uploadStatus: "ready", job: job("succeeded") })).toMatchObject({
      label: "Listo",
      polling: false,
      tone: "success",
      canRemove: true,
      canRetry: false,
    });
  });

  it("never allows removal while the job is in flight (R2.3)", () => {
    for (const status of ["queued", "processing"] as const) {
      expect(describeUpload({ uploadStatus: "uploaded", job: job(status) }).canRemove).toBe(false);
    }
    expect(describeUpload({ uploadStatus: "uploaded", job: null }).canRemove).toBe(false);
  });

  it("offers retry and removal when failed", () => {
    expect(describeUpload({ uploadStatus: "failed", job: job("failed") })).toMatchObject({
      label: "Falló",
      polling: false,
      canRetry: true,
      canRemove: true,
      tone: "danger",
    });
  });

  it("treats a failed upload without a job (rejected on confirm) as removable", () => {
    expect(describeUpload({ uploadStatus: "failed", job: null })).toMatchObject({ canRetry: false, canRemove: true });
  });

  it("treats an uploaded file whose job is not created yet as queued", () => {
    expect(describeUpload({ uploadStatus: "uploaded", job: null })).toMatchObject({ label: "En cola", polling: true });
  });
});

describe("shouldKickWorker", () => {
  const now = new Date("2026-10-12T12:00:00Z");
  const ago = (s: number) => new Date(now.getTime() - s * 1000).toISOString();

  it("kicks a job queued and due for more than 15 seconds", () => {
    expect(shouldKickWorker({ status: "queued", runAfter: ago(16), lockedAt: null, now })).toBe(true);
  });

  it("does not kick a fresh queued job (the after() worker is probably on it)", () => {
    expect(shouldKickWorker({ status: "queued", runAfter: ago(5), lockedAt: null, now })).toBe(false);
  });

  it("does not kick a retry that is not due yet", () => {
    expect(shouldKickWorker({ status: "queued", runAfter: new Date(now.getTime() + 20_000).toISOString(), lockedAt: null, now })).toBe(false);
  });

  it("kicks a processing job whose lock is stale (10 minutes)", () => {
    expect(shouldKickWorker({ status: "processing", runAfter: ago(900), lockedAt: ago(601), now })).toBe(true);
    expect(shouldKickWorker({ status: "processing", runAfter: ago(900), lockedAt: ago(60), now })).toBe(false);
  });

  it("never kicks terminal jobs", () => {
    expect(shouldKickWorker({ status: "succeeded", runAfter: ago(900), lockedAt: null, now })).toBe(false);
    expect(shouldKickWorker({ status: "failed", runAfter: ago(900), lockedAt: null, now })).toBe(false);
  });
});
