/**
 * Port for turning a recipe PDF into structured book data.
 * Adapters return the raw structured output; the ingestion service validates it
 * with `parseAiBook` (single validation path for every adapter).
 */
export interface AiBookProvider {
  readonly id: "mock" | "anthropic";
  extractBook(input: { pdfBase64: string; fileName: string; signal?: AbortSignal }): Promise<unknown>;
}

/** Provider-level failure (transport, refusal, malformed output). Message is safe to store. */
export class AiProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiProviderError";
  }
}
