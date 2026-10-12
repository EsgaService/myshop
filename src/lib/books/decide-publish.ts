import { validatePriceCents } from "./price";

export type PublishReason = "subscription_required" | "invalid_price" | "archived";
export type PublishDecision = { ok: true } | { ok: false; reason: PublishReason };

/**
 * Publishing gate (R7, R9). The subscription check comes first so the seller
 * always sees the subscribe call to action before any price problem.
 */
export function decidePublish(input: {
  status: "draft" | "published" | "archived";
  priceCents: number;
  canPublish: boolean;
}): PublishDecision {
  if (input.status === "archived") return { ok: false, reason: "archived" };
  if (!input.canPublish) return { ok: false, reason: "subscription_required" };
  if (!validatePriceCents(input.priceCents).ok) return { ok: false, reason: "invalid_price" };
  return { ok: true };
}

export function publishErrorMessage(reason: PublishReason): string {
  switch (reason) {
    case "subscription_required":
      return "Necesitas una suscripción activa para publicar. Puedes seguir preparando tu recetario mientras tanto.";
    case "invalid_price":
      return "Define un precio válido antes de publicar (entre 5.000 y 1.000.000 COP).";
    case "archived":
      return "Este recetario está archivado y no se puede publicar.";
  }
}
