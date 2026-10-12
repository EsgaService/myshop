export type Env = Record<string, string | undefined>;

/** AI_PROVIDER wins when valid; otherwise anthropic if a key exists, else mock (R14). */
export function resolveProviderId(env: Env = process.env): "mock" | "anthropic" {
  const explicit = env.AI_PROVIDER;
  if (explicit === "mock" || explicit === "anthropic") return explicit;
  return env.ANTHROPIC_API_KEY ? "anthropic" : "mock";
}
