import { describe, expect, it, vi } from "vitest";
import { parseAiBook } from "@/lib/ingestion/ai-book-schema";
import { AiProviderError } from "./types";
import { AnthropicBookProvider, TOOL_NAME, type AnthropicLike } from "./anthropic-provider";

const validBook = {
  title: "Cócteles de la casa",
  recipes: [{ title: "Mojito", ingredients: ["2 oz ron"], steps: ["Mezclar"] }],
};

function fakeClient(content: unknown[]) {
  const stream = vi.fn((_params: unknown, _opts?: unknown) => ({
    finalMessage: async () => ({ content, stop_reason: "tool_use" }),
  }));
  const client: AnthropicLike = { messages: { stream } as unknown as AnthropicLike["messages"] };
  return { client, stream };
}

const toolUse = (input: unknown) => ({ type: "tool_use", id: "t1", name: TOOL_NAME, input });

describe("AnthropicBookProvider", () => {
  it("sends the PDF as a base64 document block and forces the structured tool", async () => {
    const { client, stream } = fakeClient([toolUse(validBook)]);
    const provider = new AnthropicBookProvider({ client, model: "claude-sonnet-5-5" });

    await provider.extractBook({ pdfBase64: "QUJD", fileName: "libro.pdf" });

    const params = stream.mock.calls[0][0] as Record<string, any>;
    expect(params.model).toBe("claude-sonnet-5-5");
    expect(params.tool_choice).toEqual({ type: "tool", name: TOOL_NAME });
    expect(params.tools).toHaveLength(1);
    expect(params.tools[0].name).toBe(TOOL_NAME);
    expect(params.tools[0].input_schema.type).toBe("object");
    expect(params.tools[0].input_schema.properties.recipes).toBeDefined();
    const content = params.messages[0].content;
    expect(params.messages[0].role).toBe("user");
    expect(content[0]).toEqual({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: "QUJD" },
    });
    expect(content.some((c: any) => c.type === "text")).toBe(true);
  });

  it("returns the tool input", async () => {
    const { client } = fakeClient([{ type: "text", text: "ok" }, toolUse(validBook)]);
    const provider = new AnthropicBookProvider({ client, model: "m" });
    const out = await provider.extractBook({ pdfBase64: "QUJD", fileName: "a.pdf" });
    expect(parseAiBook(out).ok).toBe(true);
  });

  it("forwards the abort signal", async () => {
    const { client, stream } = fakeClient([toolUse(validBook)]);
    const provider = new AnthropicBookProvider({ client, model: "m" });
    const ctrl = new AbortController();
    await provider.extractBook({ pdfBase64: "QUJD", fileName: "a.pdf", signal: ctrl.signal });
    expect((stream.mock.calls[0][1] as any).signal).toBe(ctrl.signal);
  });

  it("fails when the model did not call the tool", async () => {
    const { client } = fakeClient([{ type: "text", text: "sorry" }]);
    const provider = new AnthropicBookProvider({ client, model: "m" });
    await expect(provider.extractBook({ pdfBase64: "QUJD", fileName: "a.pdf" })).rejects.toBeInstanceOf(AiProviderError);
  });

  it("fails when the tool input does not match the schema", async () => {
    const { client } = fakeClient([toolUse({ title: "x", recipes: [] })]);
    const provider = new AnthropicBookProvider({ client, model: "m" });
    await expect(provider.extractBook({ pdfBase64: "QUJD", fileName: "a.pdf" })).rejects.toBeInstanceOf(AiProviderError);
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
    await expect(provider.extractBook({ pdfBase64: "QUJD", fileName: "a.pdf" })).rejects.toBeInstanceOf(AiProviderError);
  });
});
