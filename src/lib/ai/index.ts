import { AnthropicBookProvider } from "./anthropic-provider";
import { MockAiBookProvider } from "./mock-provider";
import type { AiBookProvider } from "./types";

import { resolveProviderId, type Env } from "./resolve-provider";

export { resolveProviderId };

/** Fails closed: the mock provider is refused in production, like mock payments. */
export function getAiBookProvider(env: Env = process.env): AiBookProvider {
  if (resolveProviderId(env) === "mock") {
    if (env.NODE_ENV === "production") {
      throw new Error("The mock AI provider is not allowed in production: set ANTHROPIC_API_KEY or AI_PROVIDER=anthropic");
    }
    return new MockAiBookProvider();
  }
  if (!env.ANTHROPIC_API_KEY) throw new Error("AI_PROVIDER=anthropic requires ANTHROPIC_API_KEY");
  return new AnthropicBookProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL });
}

export * from "./types";
