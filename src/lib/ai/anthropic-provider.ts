import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { AiBookSchema, parseAiBook } from "@/lib/ingestion/ai-book-schema";
import { toStructuredOutputSchema } from "./structured-output-schema";
import { AiProviderError, type AiBookProvider } from "./types";

export const DEFAULT_MODEL = "claude-sonnet-5-5";
/**
 * Every call is billed, so the SDK never retries on its own (retries are owned by the job queue,
 * which bounds them) and a single call is cut off well before the route maxDuration (300s).
 */
export const CLIENT_MAX_RETRIES = 0;
export const CLIENT_TIMEOUT_MS = 180_000;
export const REQUEST_TIMEOUT_MS = 180_000;
const MAX_TOKENS = 16_000;

/** Minimal slice of the SDK we use, so tests can inject a fake (no network). */
export type AnthropicLike = Pick<Anthropic, "messages">;

const PROMPT = [
  "Convierte este PDF de recetas en un recetario estructurado.",
  "Responde únicamente con el recetario como un objeto JSON que cumpla el esquema indicado; no añadas texto adicional.",
  "Conserva el idioma original del documento. Incluye todas las recetas con ingredientes y pasos completos.",
  "Agrupa las recetas en categorías cuando el documento lo sugiera y usa las secciones para texto introductorio o de apoyo.",
  "No inventes recetas, ingredientes ni cantidades que no aparezcan en el documento.",
].join("\n");

function outputSchema(): Record<string, unknown> {
  return toStructuredOutputSchema(z.toJSONSchema(AiBookSchema, { io: "input" }) as Record<string, unknown>);
}

const PERMANENT_MESSAGE = "No pudimos procesar este PDF con la IA. Revisa el archivo o inténtalo con otro.";
const TRANSIENT_MESSAGE = "El servicio de IA no está disponible en este momento. Lo intentaremos de nuevo.";
const REFUSAL_MESSAGE = "La IA no pudo procesar este documento. Revisa el archivo o inténtalo con otro.";
const EMPTY_OUTPUT_MESSAGE = "La IA no devolvió un recetario. Lo intentaremos de nuevo.";
const UNREADABLE_OUTPUT_MESSAGE = "La IA devolvió una respuesta que no pudimos leer. Lo intentaremos de nuevo.";
const INVALID_BOOK_MESSAGE = "La IA devolvió un recetario con un formato inválido. Lo intentaremos de nuevo.";

/** 4xx client errors never succeed on retry, except request timeout (408), conflict (409) and rate limit (429). */
function isPermanentApiError(error: unknown): boolean {
  return (
    error instanceof Anthropic.APIError &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status < 500 &&
    ![408, 409, 429].includes(error.status)
  );
}

/** Full technical detail, for server logs only. It must never reach a seller-facing message. */
function describeCause(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    return `${error.status ?? "no status"}: ${error.message} (request_id: ${error.requestID ?? "n/a"})`.slice(0, 800);
  }
  return (error instanceof Error ? error.message : String(error)).slice(0, 800);
}

export class AnthropicBookProvider implements AiBookProvider {
  readonly id = "anthropic" as const;
  private readonly client: AnthropicLike;
  private readonly model: string;

  constructor(opts: { apiKey?: string; model?: string; client?: AnthropicLike }) {
    this.client =
      opts.client ?? new Anthropic({ apiKey: opts.apiKey, timeout: CLIENT_TIMEOUT_MS, maxRetries: CLIENT_MAX_RETRIES });
    this.model = opts.model || DEFAULT_MODEL;
  }

  async extractBook(input: { pdfBase64: string; fileName: string; signal?: AbortSignal }): Promise<unknown> {
    // Streaming responses are not covered by the client timeout once headers arrive, so bound the whole call.
    const signals = [AbortSignal.timeout(REQUEST_TIMEOUT_MS), ...(input.signal ? [input.signal] : [])];
    const signal = AbortSignal.any(signals);
    let message;
    try {
      message = await this.client.messages
        .stream(
          {
            model: this.model,
            max_tokens: MAX_TOKENS,
            output_config: { format: { type: "json_schema", schema: outputSchema() } },
            messages: [
              {
                role: "user",
                content: [
                  { type: "document", source: { type: "base64", media_type: "application/pdf", data: input.pdfBase64 } },
                  { type: "text", text: PROMPT },
                ],
              },
            ],
          },
          { signal },
        )
        .finalMessage();
    } catch (cause) {
      console.error("[ai] Anthropic request failed:", describeCause(cause));
      const permanent = isPermanentApiError(cause);
      throw new AiProviderError(permanent ? PERMANENT_MESSAGE : TRANSIENT_MESSAGE, { cause, retryable: !permanent });
    }

    if (message.stop_reason === "max_tokens") {
      throw new AiProviderError("El PDF es demasiado extenso para convertirlo en un solo recetario. Divídelo en partes más pequeñas.", {
        retryable: false,
      });
    }

    if (message.stop_reason === "refusal") {
      throw new AiProviderError(REFUSAL_MESSAGE, { retryable: false });
    }

    const text = message.content.flatMap((c) => (c.type === "text" ? [c.text] : [])).join("");
    if (!text.trim()) throw new AiProviderError(EMPTY_OUTPUT_MESSAGE);

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (cause) {
      console.error("[ai] Anthropic returned invalid JSON:", describeCause(cause));
      throw new AiProviderError(UNREADABLE_OUTPUT_MESSAGE, { cause });
    }

    const parsed = parseAiBook(raw);
    if (!parsed.ok) {
      console.error("[ai] AI output did not match the book schema:", parsed.error);
      throw new AiProviderError(INVALID_BOOK_MESSAGE);
    }
    return parsed.data;
  }
}
