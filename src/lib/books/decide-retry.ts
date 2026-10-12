/** Manual retries allowed per upload (each one re-bills the AI). */
export const MAX_MANUAL_RETRIES = 3;

export type RetryReason = "subscription_required" | "retry_limit";
export type RetryDecision = { ok: true } | { ok: false; reason: RetryReason };

/** Gate for manually retrying a failed ingestion. The subscription check comes first. */
export function decideRetry(input: { hasActiveSubscription: boolean; manualRetries: number }): RetryDecision {
  if (!input.hasActiveSubscription) return { ok: false, reason: "subscription_required" };
  if (input.manualRetries >= MAX_MANUAL_RETRIES) return { ok: false, reason: "retry_limit" };
  return { ok: true };
}

export function retryErrorMessage(reason: RetryReason): string {
  switch (reason) {
    case "subscription_required":
      return "Necesitas una suscripción activa para procesar PDF.";
    case "retry_limit":
      return `Ya reintentaste este archivo ${MAX_MANUAL_RETRIES} veces. Elimínalo y sube otro PDF.`;
  }
}
