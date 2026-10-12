export type MoveUploadReason = "not_ready" | "same_product" | "invalid_target" | "last_ready_pdf" | "rpc_missing";
export type MoveUploadDecision = { ok: true } | { ok: false; reason: MoveUploadReason };

/**
 * Whether a ready PDF can move from its product to another one of the same seller. The SQL RPC
 * (`move_upload_to_book`) repeats every guard under the product locks as the race-safe backstop.
 */
export function decideMoveUpload(input: {
  uploadStatus: "pending" | "uploaded" | "processing" | "ready" | "failed";
  uploadRemoved: boolean;
  sourceId: string;
  sourceStatus: "draft" | "published" | "archived";
  sourceIsLegacy: boolean;
  targetId: string;
  targetIsLegacy: boolean;
  targetIsArchived: boolean;
  /** Other active (not removed) ready PDFs of the source product. */
  otherReadyCount: number;
}): MoveUploadDecision {
  if (input.uploadStatus !== "ready" || input.uploadRemoved) return { ok: false, reason: "not_ready" };
  if (input.targetId === input.sourceId) return { ok: false, reason: "same_product" };
  if (input.sourceIsLegacy || input.targetIsLegacy || input.targetIsArchived) {
    return { ok: false, reason: "invalid_target" };
  }
  if (input.sourceStatus === "published" && input.otherReadyCount === 0) {
    return { ok: false, reason: "last_ready_pdf" };
  }
  return { ok: true };
}

export type MoveRpcFailure = "last_ready_pdf" | "not_ready" | "invalid_target" | "rpc_missing" | "not_found" | "unknown";

/**
 * Classifies a PostgREST error from `move_upload_to_book`. The RPC ships in a migration the owner applies
 * by hand, so "function not found" (PGRST202 / 42883) is an expected state, not a crash.
 */
export function classifyMoveRpcError(error: { code?: string | null; message?: string | null }): MoveRpcFailure {
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (code === "PGRST202" || code === "42883") return "rpc_missing";
  if (message.includes("last_ready_pdf")) return "last_ready_pdf";
  if (message.includes("upload_not_ready")) return "not_ready";
  if (message.includes("invalid_target")) return "invalid_target";
  if (message.includes("upload_not_owned")) return "not_found";
  return "unknown";
}

export function moveUploadErrorMessage(reason: MoveUploadReason): string {
  switch (reason) {
    case "not_ready":
      return "Solo se pueden mover PDF que ya estén listos.";
    case "same_product":
      return "Elige otro producto como destino.";
    case "invalid_target":
      return "No puedes mover este PDF a ese destino. Elige otro producto.";
    case "last_ready_pdf":
      return "Este es el único PDF listo del producto publicado. Despublica el producto o sube otro PDF antes de moverlo.";
    case "rpc_missing":
      return "Mover PDFs todavía no está disponible. Inténtalo más tarde.";
  }
}
