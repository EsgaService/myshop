import { describe, expect, it } from "vitest";
import { parseAiBook } from "@/lib/ingestion/ai-book-schema";
import { getAiBookProvider, resolveProviderId } from "./index";
import { MockAiBookProvider } from "./mock-provider";

describe("resolveProviderId", () => {
  it("defaults to anthropic when a key exists", () => {
    expect(resolveProviderId({ ANTHROPIC_API_KEY: "k" })).toBe("anthropic");
  });
  it("defaults to mock without a key", () => {
    expect(resolveProviderId({})).toBe("mock");
    expect(resolveProviderId({ ANTHROPIC_API_KEY: "" })).toBe("mock");
  });
  it("AI_PROVIDER overrides the default", () => {
    expect(resolveProviderId({ AI_PROVIDER: "mock", ANTHROPIC_API_KEY: "k" })).toBe("mock");
    expect(resolveProviderId({ AI_PROVIDER: "anthropic" })).toBe("anthropic");
  });
  it("ignores unknown AI_PROVIDER values", () => {
    expect(resolveProviderId({ AI_PROVIDER: "gpt", ANTHROPIC_API_KEY: "k" })).toBe("anthropic");
    expect(resolveProviderId({ AI_PROVIDER: "gpt" })).toBe("mock");
  });
});

describe("getAiBookProvider", () => {
  it("returns the mock provider without a key", () => {
    expect(getAiBookProvider({}).id).toBe("mock");
  });
  it("returns the anthropic provider with a key", () => {
    expect(getAiBookProvider({ ANTHROPIC_API_KEY: "sk-test" }).id).toBe("anthropic");
  });
  it("refuses anthropic without a key", () => {
    expect(() => getAiBookProvider({ AI_PROVIDER: "anthropic" })).toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe("MockAiBookProvider", () => {
  it("returns a deterministic book that passes the schema", async () => {
    const p = new MockAiBookProvider();
    const a = await p.extractBook({ pdfBase64: "QUJD", fileName: "Mi Libro.pdf" });
    const b = await p.extractBook({ pdfBase64: "QUJD", fileName: "Mi Libro.pdf" });
    expect(a).toEqual(b);
    expect(parseAiBook(a).ok).toBe(true);
  });
  it("derives the title from the file name", async () => {
    const out = (await new MockAiBookProvider().extractBook({ pdfBase64: "", fileName: "mis-postres.pdf" })) as { title: string };
    expect(out.title.toLowerCase()).toContain("mis postres");
  });
});
