/**
 * Port for turning a recipe PDF into structured book data.
 * Adapters return the raw structured output; the ingestion service validates it
 * with `parseAiBook` (single validation path for every adapter).
 */
export interface AiBookProvider {
  readonly id: "mock" | "anthropic";
  extractBook(input: { pdfBase64: string; fileName: string; signal?: AbortSignal }): Promise<unknown>;
}

/**
 * Provider-level failure (transport, refusal, malformed output). Message is safe to store.
 * `retryable: false` marks failures a retry cannot fix (e.g. truncated output): they are
 * never paid for twice.
 */
export class AiProviderError extends Error {
  readonly retryable: boolean;

  constructor(message: string, options?: { cause?: unknown; retryable?: boolean }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AiProviderError";
    this.retryable = options?.retryable ?? true;
  }
}
