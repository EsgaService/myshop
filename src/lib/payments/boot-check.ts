/** Returns a human-readable problem with the payments configuration, or null when fine. */
export function paymentsBootIssue(env: Record<string, string | undefined>): string | null {
  if (env.PAYMENTS_MODE === "mock" && env.NODE_ENV === "production") {
    return "PAYMENTS_MODE=mock is set in production: all payment paths are refused until a real provider is configured.";
  }
  return null;
}
