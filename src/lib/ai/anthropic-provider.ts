import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { AiBookSchema, parseAiBook } from "@/lib/ingestion/ai-book-schema";
import { AiProviderError, type AiBookProvider } from "./types";

export const TOOL_NAME = "save_recipe_book";
export const DEFAULT_MODEL = "claude-sonnet-5-5";
const CLIENT_TIMEOUT_MS = 240_000;
const MAX_RETRIES = 2;
const MAX_TOKENS = 16_000;

/** Minimal slice of the SDK we use, so tests can inject a fake (no network). */
export type AnthropicLike = Pick<Anthropic, "messages">;

const PROMPT = [
  "Convierte este PDF de recetas en un recetario estructurado.",
  `Llama a la herramienta ${TOOL_NAME} con el resultado; no respondas con texto libre.`,
  "Conserva el idioma original del documento. Incluye todas las recetas con ingredientes y pasos completos.",
  "Agrupa las recetas en categorías cuando el documento lo sugiera y usa las secciones para texto introductorio o de apoyo.",
  "No inventes recetas, ingredientes ni cantidades que no aparezcan en el documento.",
].join("\n");

function toolInputSchema(): Anthropic.Tool.InputSchema {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(AiBookSchema, { io: "input" }) as Record<string, unknown>;
  return schema as Anthropic.Tool.InputSchema;
}

export class AnthropicBookProvider implements AiBookProvider {
  readonly id = "anthropic" as const;
  private readonly client: AnthropicLike;
  private readonly model: string;

  constructor(opts: { apiKey?: string; model?: string; client?: AnthropicLike }) {
    this.client =
      opts.client ?? new Anthropic({ apiKey: opts.apiKey, timeout: CLIENT_TIMEOUT_MS, maxRetries: MAX_RETRIES });
    this.model = opts.model || DEFAULT_MODEL;
  }

  async extractBook(input: { pdfBase64: string; fileName: string; signal?: AbortSignal }): Promise<unknown> {
    let message;
    try {
      message = await this.client.messages
        .stream(
          {
            model: this.model,
            max_tokens: MAX_TOKENS,
            tools: [
              {
                name: TOOL_NAME,
                description: "Guarda el recetario estructurado extraído del PDF.",
                input_schema: toolInputSchema(),
              },
            ],
            tool_choice: { type: "tool", name: TOOL_NAME },
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
          { signal: input.signal },
        )
        .finalMessage();
    } catch (cause) {
      throw new AiProviderError("The AI provider request failed", { cause });
    }

    const block = message.content.find((c) => c.type === "tool_use" && c.name === TOOL_NAME);
    if (!block || block.type !== "tool_use") {
      throw new AiProviderError("The AI provider did not return a structured book");
    }

    const parsed = parseAiBook(block.input);
    if (!parsed.ok) throw new AiProviderError(`The AI output did not match the book schema: ${parsed.error}`);
    return parsed.data;
  }
}
