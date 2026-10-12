import { resolveProviderId, type Env } from "./resolve-provider";

/** Returns a human-readable problem with the AI provider configuration, or null when fine. */
export function aiBootIssue(env: Env): string | null {
  if (env.NODE_ENV === "production" && resolveProviderId(env) === "mock") {
    return "The mock AI provider would be used in production: PDF ingestion is refused until ANTHROPIC_API_KEY (or AI_PROVIDER=anthropic) is configured.";
  }
  return null;
}
