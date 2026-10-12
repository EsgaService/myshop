import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { parseAiBook } from "@/lib/ingestion/ai-book-schema";
import { AiProviderError } from "./types";
import {
  AnthropicBookProvider,
  CLIENT_MAX_RETRIES,
  CLIENT_TIMEOUT_MS,
  REQUEST_TIMEOUT_MS,
  type AnthropicLike,
} from "./anthropic-provider";

const validBook = {
  title: "Cócteles de la casa",
  recipes: [{ title: "Mojito", ingredients: ["2 oz ron"], steps: ["Mezclar"] }],
};

function fakeClient(content: unknown[], stopReason = "end_turn") {
  const stream = vi.fn((_params: unknown, _opts?: unknown) => ({
    finalMessage: async () => ({ content, stop_reason: stopReason }),
  }));
  const client: AnthropicLike = { messages: { stream } as unknown as AnthropicLike["messages"] };
  return { client, stream };
}

const PERMANENT_MESSAGE = "No pudimos procesar este PDF con la IA. Revisa el archivo o inténtalo con otro.";
const TRANSIENT_MESSAGE = "El servicio de IA no está disponible en este momento. Lo intentaremos de nuevo.";

const json = (input: unknown) => ({ type: "text", text: JSON.stringify(input) });

describe("AnthropicBookProvider", () => {
  it("sends the PDF as a base64 document block and requests structured JSON output", async () => {
    const { client, stream } = fakeClient([json(validBook)]);
    const provider = new AnthropicBookProvider({ client, model: "claude-sonnet-5-5" });

    await provider.extractBook({ pdfBase64: "QUJD", fileName: "libro.pdf" });

    const params = stream.mock.calls[0][0] as Record<string, any>;
    expect(params.model).toBe("claude-sonnet-5-5");
    expect(params.tools).toBeUndefined();
    expect(params.tool_choice).toBeUndefined();
    expect(params.output_config.format.type).toBe("json_schema");
    expect(params.output_config.format.schema.type).toBe("object");
    expect(params.output_config.format.schema.additionalProperties).toBe(false);
    expect(params.output_config.format.schema.properties.recipes).toBeDefined();
    const content = params.messages[0].content;
    expect(params.messages[0].role).toBe("user");
    expect(content[0]).toEqual({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: "QUJD" },
    });
    expect(content.some((c: any) => c.type === "text")).toBe(true);
  });

  it("returns the parsed JSON book", async () => {
    const { client } = fakeClient([{ type: "thinking", thinking: "..." }, json(validBook)]);
    const provider = new AnthropicBookProvider({ client, model: "m" });
    const out = await provider.extractBook({ pdfBase64: "QUJD", fileName: "a.pdf" });
    expect(parseAiBook(out).ok).toBe(true);
  });

  it("never retries inside the SDK and bounds a call under the route maxDuration (300s)", () => {
    expect(CLIENT_MAX_RETRIES).toBe(0);
    expect(CLIENT_TIMEOUT_MS).toBe(180_000);
    expect(REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(180_000);
  });

  it("aborts the request when the caller signal aborts", async () => {
    const { client, stream } = fakeClient([json(validBook)]);
    const provider = new AnthropicBookProvider({ client, model: "m" });
    const ctrl = new AbortController();
    await provider.extractBook({ pdfBase64: "QUJD", fileName: "a.pdf", signal: ctrl.signal });
    const sent = (stream.mock.calls[0][1] as { signal: AbortSignal }).signal;
    expect(sent.aborted).toBe(false);
    ctrl.abort();
    expect(sent.aborted).toBe(true);
  });

  it("always sends a signal so a call cannot hang without a caller deadline", async () => {
    const { client, stream } = fakeClient([json(validBook)]);
    const provider = new AnthropicBookProvider({ client, model: "m" });
    await provider.extractBook({ pdfBase64: "QUJD", fileName: "a.pdf" });
    const sent = (stream.mock.calls[0][1] as { signal: AbortSignal }).signal;
    expect(sent).toBeInstanceOf(AbortSignal);
    expect(sent.aborted).toBe(false);
  });

  it("fails with a NON-retryable error when the output was truncated (max_tokens)", async () => {
    const { client } = fakeClient([json(validBook)], "max_tokens");
    const provider = new AnthropicBookProvider({ client, model: "m" });
    const error = await provider.extractBook({ pdfBase64: "QUJD", fileName: "a.pdf" }).catch((e) => e);
    expect(error).toBeInstanceOf(AiProviderError);
    expect((error as AiProviderError).retryable).toBe(false);
  });

  it("fails (retryable) when the model returned no text", async () => {
    const { client } = fakeClient([]);
    const provider = new AnthropicBookProvider({ client, model: "m" });
    await expect(provider.extractBook({ pdfBase64: "QUJD", fileName: "a.pdf" })).rejects.toBeInstanceOf(AiProviderError);
  });

  it("fails with a readable error when the text is not valid JSON", async () => {
    const { client } = fakeClient([{ type: "text", text: "{not json" }]);
    const provider = new AnthropicBookProvider({ client, model: "m" });
    const error = await provider.extractBook({ pdfBase64: "QUJD", fileName: "a.pdf" }).catch((e) => e);
    expect(error).toBeInstanceOf(AiProviderError);
    const message = (error as AiProviderError).message;
    expect(message).toBe("La IA devolvió una respuesta que no pudimos leer. Lo intentaremos de nuevo.");
    expect(message).not.toMatch(/JSON/);
  });

  it("fails with a NON-retryable error when the model refuses", async () => {
    const { client } = fakeClient([], "refusal");
    const provider = new AnthropicBookProvider({ client, model: "m" });
    const error = await provider.extractBook({ pdfBase64: "QUJD", fileName: "a.pdf" }).catch((e) => e);
    expect(error).toBeInstanceOf(AiProviderError);
    expect((error as AiProviderError).retryable).toBe(false);
  });

  it("fails when the JSON does not match the schema", async () => {
    const { client } = fakeClient([json({ title: "x", recipes: [] })]);
    const provider = new AnthropicBookProvider({ client, model: "m" });
    const error = await provider.extractBook({ pdfBase64: "QUJD", fileName: "a.pdf" }).catch((e) => e);
    expect(error).toBeInstanceOf(AiProviderError);
    expect((error as AiProviderError).message).not.toMatch(/schema|recipes/i);
    expect((error as AiProviderError).message).toMatch(/IA/);
  });

  it("wraps SDK errors", async () => {
    const client: AnthropicLike = {
      messages: {
        stream: () => {
          throw new Error("boom");
        },
      } as unknown as AnthropicLike["messages"],
    };
    const provider = new AnthropicBookProvider({ client, model: "m" });
    const error = await provider.extractBook({ pdfBase64: "QUJD", fileName: "a.pdf" }).catch((e) => e);
    expect(error).toBeInstanceOf(AiProviderError);
    expect((error as AiProviderError).retryable).toBe(true);
    expect((error as AiProviderError).message).not.toContain("boom");
    expect((error as AiProviderError).message).toBe(TRANSIENT_MESSAGE);
    expect(((error as AiProviderError).cause as Error).message).toBe("boom");
  });

  function failingClient(error: unknown): AnthropicLike {
    return {
      messages: {
        stream: () => ({
          finalMessage: async () => {
            throw error;
          },
        }),
      } as unknown as AnthropicLike["messages"],
    };
  }
  const h = new Headers();

  it.each([
    ["400", Anthropic.APIError.generate(400, { error: { message: "bad schema" } }, "bad schema", h)],
    ["401", Anthropic.APIError.generate(401, { error: { message: "no key" } }, "no key", h)],
    ["403", Anthropic.APIError.generate(403, { error: { message: "denied" } }, "denied", h)],
    ["404", Anthropic.APIError.generate(404, { error: { message: "no model" } }, "no model", h)],
    ["413", Anthropic.APIError.generate(413, { error: { message: "too large" } }, "too large", h)],
    ["422", Anthropic.APIError.generate(422, { error: { message: "unprocessable" } }, "unprocessable", h)],
  ])("marks a %s API error as NON-retryable with a stable seller message", async (_n, apiError) => {
    const provider = new AnthropicBookProvider({ client: failingClient(apiError), model: "m" });
    const error = await provider.extractBook({ pdfBase64: "QUJD", fileName: "a.pdf" }).catch((e) => e);
    expect(error).toBeInstanceOf(AiProviderError);
    expect((error as AiProviderError).retryable).toBe(false);
    expect((error as AiProviderError).message).toBe(PERMANENT_MESSAGE);
    expect((error as AiProviderError).cause).toBe(apiError);
  });

  it.each([
    ["408", Anthropic.APIError.generate(408, { error: { message: "timeout" } }, "timeout", h)],
    ["409", Anthropic.APIError.generate(409, { error: { message: "conflict" } }, "conflict", h)],
    ["429", Anthropic.APIError.generate(429, { error: { message: "slow down" } }, "slow down", h)],
    ["500", Anthropic.APIError.generate(500, { error: { message: "oops" } }, "oops", h)],
    ["529", Anthropic.APIError.generate(529, { error: { message: "overloaded" } }, "overloaded", h)],
  ])("keeps a %s API error retryable", async (_n, apiError) => {
    const provider = new AnthropicBookProvider({ client: failingClient(apiError), model: "m" });
    const error = await provider.extractBook({ pdfBase64: "QUJD", fileName: "a.pdf" }).catch((e) => e);
    expect((error as AiProviderError).retryable).toBe(true);
    expect((error as AiProviderError).message).toBe(TRANSIENT_MESSAGE);
  });

  it("logs the full cause server-side and never leaks it in the message", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const apiError = Anthropic.APIError.generate(400, { error: { message: "bad schema" }, request_id: "req_123" }, "bad schema", h);
    const provider = new AnthropicBookProvider({ client: failingClient(apiError), model: "m" });
    const error = await provider.extractBook({ pdfBase64: "QUJD", fileName: "a.pdf" }).catch((e) => e);
    expect((error as AiProviderError).message).not.toMatch(/400|bad schema|req_/);
    expect(spy.mock.calls.flat().join(" ")).toContain("bad schema");
    spy.mockRestore();
  });

  it("keeps connection errors retryable", async () => {
    const provider = new AnthropicBookProvider({ client: failingClient(new Anthropic.APIConnectionError({})), model: "m" });
    const error = await provider.extractBook({ pdfBase64: "QUJD", fileName: "a.pdf" }).catch((e) => e);
    expect((error as AiProviderError).retryable).toBe(true);
  });
});
