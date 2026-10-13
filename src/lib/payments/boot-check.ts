import { parseWompiConfig } from "./wompi/config";

/** Returns a human-readable problem with the payments configuration, or null when fine. Never prints secret values. */
export function paymentsBootIssue(env: Record<string, string | undefined>): string | null {
  const production = env.NODE_ENV === "production";

  if (env.PAYMENTS_MODE === "mock" && production) {
    return "PAYMENTS_MODE=mock is set in production: all payment paths are refused until a real provider is configured.";
  }

  if (env.PAYMENTS_MODE === "wompi") {
    const parsed = parseWompiConfig(env);
    if (!parsed.ok) return `PAYMENTS_MODE=wompi but the Wompi configuration is invalid: ${parsed.error}. Payments are refused.`;
    if (production && parsed.config.environment === "test") {
      return "PAYMENTS_MODE=wompi uses sandbox (test) keys in production: payments are refused because sandbox approvals are not real money.";
    }
    if (production && !env.NEXT_PUBLIC_SITE_URL?.trim()) {
      return "PAYMENTS_MODE=wompi needs NEXT_PUBLIC_SITE_URL in production: Wompi sends buyers back to that origin.";
    }
  }
  return null;
}
