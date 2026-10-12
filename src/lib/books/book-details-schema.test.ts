import { describe, expect, it } from "vitest";
import { parseBookDetails } from "./book-details-schema";

describe("parseBookDetails", () => {
  it("accepts a title and nulls empty optional fields", () => {
    expect(parseBookDetails({ title: " Tortas ", tagline: "", description: "" })).toEqual({
      ok: true,
      value: { title: "Tortas", tagline: null, description: null },
    });
  });

  it("requires a title up to 120 characters", () => {
    expect(parseBookDetails({ title: "  ", tagline: "", description: "" }).ok).toBe(false);
    expect(parseBookDetails({ title: "x".repeat(121), tagline: "", description: "" }).ok).toBe(false);
  });

  it("limits tagline and description", () => {
    expect(parseBookDetails({ title: "A", tagline: "x".repeat(161), description: "" }).ok).toBe(false);
    expect(parseBookDetails({ title: "A", tagline: "", description: "x".repeat(2001) }).ok).toBe(false);
  });

  it("never returns price, status or ownership fields", () => {
    const r = parseBookDetails({ title: "A", tagline: "", description: "", price_cents: 1, status: "published", seller_id: "x" });
    expect(r.ok && Object.keys(r.value).sort()).toEqual(["description", "tagline", "title"]);
  });
});
