export type RemoveUploadReason = "processing" | "last_ready_pdf" | "rpc_missing";
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

export type RemoveRpcFailure = "last_ready_pdf" | "rpc_missing" | "not_found" | "unknown";

/**
 * Classifies a PostgREST error from `remove_upload_from_book`. The RPC ships in a migration the owner
 * applies by hand, so "function not found" (PGRST202 / 42883) is an expected state, not a crash.
 */
export function classifyRemoveRpcError(error: { code?: string | null; message?: string | null }): RemoveRpcFailure {
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (code === "PGRST202" || code === "42883") return "rpc_missing";
  if (message.includes("last_ready_pdf")) return "last_ready_pdf";
  if (message.includes("upload_not_owned")) return "not_found";
  return "unknown";
}

export function removeUploadErrorMessage(reason: RemoveUploadReason): string {
  switch (reason) {
    case "processing":
      return "Este PDF se está procesando. Espera a que termine para eliminarlo.";
    case "last_ready_pdf":
      return "Este es el único PDF listo del producto publicado. Despublica el producto o sube otro PDF antes de eliminarlo.";
    case "rpc_missing":
      return "Eliminar PDFs listos todavía no está disponible. Inténtalo más tarde.";
  }
}
