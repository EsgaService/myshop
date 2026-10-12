import { AnthropicBookProvider } from "./anthropic-provider";
import { MockAiBookProvider } from "./mock-provider";
import type { AiBookProvider } from "./types";

type Env = Record<string, string | undefined>;

/** AI_PROVIDER wins when valid; otherwise anthropic if a key exists, else mock (R14). */
export function resolveProviderId(env: Env = process.env): "mock" | "anthropic" {
  const explicit = env.AI_PROVIDER;
  if (explicit === "mock" || explicit === "anthropic") return explicit;
  return env.ANTHROPIC_API_KEY ? "anthropic" : "mock";
}

export function getAiBookProvider(env: Env = process.env): AiBookProvider {
  if (resolveProviderId(env) === "mock") return new MockAiBookProvider();
  if (!env.ANTHROPIC_API_KEY) throw new Error("AI_PROVIDER=anthropic requires ANTHROPIC_API_KEY");
  return new AnthropicBookProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL });
}

export * from "./types";
