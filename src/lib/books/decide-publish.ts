import { validatePriceCents } from "./price";

export type PublishReason = "subscription_required" | "invalid_price" | "archived" | "no_ready_pdf";
export type PublishDecision = { ok: true } | { ok: false; reason: PublishReason };

/**
 * Publishing gate (R7, R9, R5.1). The subscription check comes first so the seller
 * always sees the subscribe call to action before any other problem; a product needs
 * at least one ready PDF unless it is a legacy platform book (no uploads).
 */
export function decidePublish(input: {
  status: "draft" | "published" | "archived";
  priceCents: number;
  canPublish: boolean;
  /** Active (not removed) PDFs with status `ready`. */
  readyPdfCount: number;
  /** Legacy platform book (`legacy_store_id` set): exempt from the PDF requirement. */
  isLegacy: boolean;
}): PublishDecision {
  if (input.status === "archived") return { ok: false, reason: "archived" };
  if (!input.canPublish) return { ok: false, reason: "subscription_required" };
  if (!input.isLegacy && input.readyPdfCount < 1) return { ok: false, reason: "no_ready_pdf" };
  if (!validatePriceCents(input.priceCents).ok) return { ok: false, reason: "invalid_price" };
  return { ok: true };
}

/**
 * Post-publish re-check: a concurrent removal of the last ready PDF can slip between the
 * pre-check and the status update, so the publication must be reverted when none is left.
 */
export function mustRevertPublish(input: { readyPdfCountAfter: number; isLegacy: boolean }): boolean {
  return !input.isLegacy && input.readyPdfCountAfter < 1;
}

export function publishErrorMessage(reason: PublishReason): string {
  switch (reason) {
    case "subscription_required":
      return "Necesitas una suscripción activa para publicar. Puedes seguir preparando tu recetario mientras tanto.";
    case "invalid_price":
      return "Define un precio válido antes de publicar (entre 5.000 y 1.000.000 COP).";
    case "archived":
      return "Este recetario está archivado y no se puede publicar.";
    case "no_ready_pdf":
      return "Necesitas al menos un PDF listo para publicar. Sube un PDF y espera a que termine de procesarse.";
  }
}
