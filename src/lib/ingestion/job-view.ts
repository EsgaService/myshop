import type { BadgeTone } from "@/components/ui/Badge";

export type JobStatusValue = "queued" | "processing" | "succeeded" | "failed";
export type UploadStatusValue = "pending" | "uploaded" | "processing" | "ready" | "failed";

export type UploadView = {
  label: string;
  tone: BadgeTone;
  /** The UI should keep polling the status endpoint. */
  polling: boolean;
  canRetry: boolean;
  canRemove: boolean;
};

/** Maps upload + job state to what the seller sees (R12). */
export function describeUpload(input: {
  uploadStatus: UploadStatusValue;
  job: { status: JobStatusValue; attempts: number; max_attempts: number } | null;
}): UploadView {
  const { job, uploadStatus } = input;

  if (!job) {
    if (uploadStatus === "pending") {
      return { label: "Subida incompleta", tone: "warning", polling: false, canRetry: false, canRemove: true };
    }
    if (uploadStatus === "failed") {
      return { label: "Falló", tone: "danger", polling: false, canRetry: false, canRemove: true };
    }
    // Uploaded but the job row is not visible yet: it is about to be queued.
    return { label: "En cola", tone: "neutral", polling: true, canRetry: false, canRemove: false };
  }

  switch (job.status) {
    case "queued":
      return { label: "En cola", tone: "neutral", polling: true, canRetry: false, canRemove: false };
    case "processing":
      return { label: "Procesando con IA", tone: "primary", polling: true, canRetry: false, canRemove: false };
    case "succeeded":
      return { label: "Listo", tone: "success", polling: false, canRetry: false, canRemove: true };
    case "failed":
      return { label: "Falló", tone: "danger", polling: false, canRetry: true, canRemove: true };
  }
}

const QUEUED_GRACE_MS = 15_000;
const STALE_LOCK_MS = 10 * 60_000;

/**
 * Whether the status poll should also kick the worker: a job that has been due for
 * more than 15s was not picked up by the after() worker (e.g. the process restarted),
 * and a processing job with a stale lock is claimable again.
 */
export function shouldKickWorker(input: {
  status: JobStatusValue;
  runAfter: string;
  lockedAt: string | null;
  now: Date;
}): boolean {
  const now = input.now.getTime();
  if (input.status === "queued") return now - new Date(input.runAfter).getTime() > QUEUED_GRACE_MS;
  if (input.status === "processing") return input.lockedAt !== null && now - new Date(input.lockedAt).getTime() > STALE_LOCK_MS;
  return false;
}
