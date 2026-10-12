export type RemoveUploadReason = "processing" | "last_ready_pdf";
export type RemoveUploadDecision = { ok: true } | { ok: false; reason: RemoveUploadReason };

/**
 * Whether a PDF can be removed from its product (R2.2, R2.3). In-flight PDFs are never removable:
 * the ingestion RPC discards late results, but the UI does not offer the action. The SQL RPC repeats
 * the last-PDF guard under the book lock as the race-safe backstop.
 */
export function decideRemoveUpload(input: {
  bookStatus: "draft" | "published" | "archived";
  uploadStatus: "pending" | "uploaded" | "processing" | "ready" | "failed";
  jobStatus: "queued" | "processing" | "succeeded" | "failed" | null;
  /** Other active (not removed) ready PDFs of the same product. */
  otherReadyCount: number;
}): RemoveUploadDecision {
  const inFlight =
    input.jobStatus === "queued" ||
    input.jobStatus === "processing" ||
    input.uploadStatus === "uploaded" ||
    input.uploadStatus === "processing";
  if (inFlight) return { ok: false, reason: "processing" };

  if (input.bookStatus === "published" && input.uploadStatus === "ready" && input.otherReadyCount === 0) {
    return { ok: false, reason: "last_ready_pdf" };
  }
  return { ok: true };
}

export function removeUploadErrorMessage(reason: RemoveUploadReason): string {
  switch (reason) {
    case "processing":
      return "Este PDF se está procesando. Espera a que termine para eliminarlo.";
    case "last_ready_pdf":
      return "Este es el único PDF listo del producto publicado. Despublica el producto o sube otro PDF antes de eliminarlo.";
  }
}
