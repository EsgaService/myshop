import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AiBookSchema } from "@/lib/ingestion/ai-book-schema";
import { toStructuredOutputSchema } from "./structured-output-schema";

describe("toStructuredOutputSchema", () => {
  it("adds additionalProperties:false to every object and drops $schema", () => {
    const out = toStructuredOutputSchema({
      $schema: "x",
      type: "object",
      properties: { a: { type: "object", properties: { b: { type: "string" } }, required: ["b"] } },
      required: ["a"],
    });
    expect(out).not.toHaveProperty("$schema");
    expect(out.additionalProperties).toBe(false);
    expect((out.properties as any).a.additionalProperties).toBe(false);
  });

  it("strips unsupported constraint keywords but keeps enum, const, anyOf and descriptions", () => {
    const out = toStructuredOutputSchema({
      type: "object",
      properties: {
        s: { type: "string", minLength: 1, maxLength: 9, pattern: "x", description: "d" },
        n: { type: "number", minimum: 1, maximum: 5 },
        l: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
        e: { type: "string", enum: ["p", "h"] },
        u: { anyOf: [{ type: "string", const: "ul" }, { type: "null" }] },
      },
      required: ["s", "n", "l", "e", "u"],
    });
    const p = out.properties as Record<string, any>;
    expect(p.s).toEqual({ type: "string", description: "d" });
    expect(p.n).toEqual({ type: "number" });
    expect(p.l).toEqual({ type: "array", items: { type: "string" } });
    expect(p.e.enum).toEqual(["p", "h"]);
    expect(p.u.anyOf[0].const).toBe("ul");
  });

  it("removes free-form map properties (dynamic keys are unsupported) and their required entry", () => {
    const out = toStructuredOutputSchema({
      type: "object",
      properties: { keep: { type: "string" }, extras: { type: "object", additionalProperties: { type: "string" } } },
      required: ["keep", "extras"],
    });
    expect(Object.keys(out.properties as object)).toEqual(["keep"]);
    expect(out.required).toEqual(["keep"]);
  });

  it("rewrites oneOf as anyOf", () => {
    const out = toStructuredOutputSchema({ oneOf: [{ type: "string" }, { type: "number" }] });
    expect(out.oneOf).toBeUndefined();
    expect(out.anyOf).toEqual([{ type: "string" }, { type: "number" }]);
  });

  it("recurses into $defs and keeps $ref", () => {
    const out = toStructuredOutputSchema({
      type: "object",
      properties: { r: { $ref: "#/$defs/R" } },
      $defs: { R: { type: "object", properties: { x: { type: "string", minLength: 1 } } } },
    });
    const r = (out.$defs as any).R;
    expect(r.additionalProperties).toBe(false);
    expect(r.properties.x).toEqual({ type: "string" });
    expect((out.properties as any).r.$ref).toBe("#/$defs/R");
  });

  it("produces an object-only, constraint-free schema for AiBookSchema", () => {
    const raw = z.toJSONSchema(AiBookSchema, { io: "input" });
    const out = toStructuredOutputSchema(raw as Record<string, unknown>);
    const text = JSON.stringify(out);
    expect(text).not.toMatch(/minLength|minItems|maxItems|"\$schema"/);
    expect(JSON.stringify(out.properties)).toContain('"tipo"');
    expect(text).not.toContain('"extras"');
    expect(out.additionalProperties).toBe(false);
  });
});
