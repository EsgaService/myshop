import { describe, expect, it } from "vitest";
import { toSellerSlug } from "./slug";

describe("toSellerSlug (R4)", () => {
  it("slugifies the store name", () => {
    expect(toSellerSlug("Cocina de Ana", [])).toBe("cocina-de-ana");
    expect(toSellerSlug("  Piña & Coco!  ", [])).toBe("pina-coco");
  });

  it("appends a numeric suffix when the slug is taken", () => {
    expect(toSellerSlug("Ana", ["ana"])).toBe("ana-2");
    expect(toSellerSlug("Ana", ["ana", "ana-2", "ana-3"])).toBe("ana-4");
  });

  it("never returns a reserved slug", () => {
    expect(toSellerSlug("Vendedor", [])).toBe("vendedor-2");
    expect(toSellerSlug("API", [])).toBe("api-2");
    expect(toSellerSlug("MyShop", [])).toBe("myshop-2");
  });

  it("falls back to a default for names without usable characters", () => {
    expect(toSellerSlug("!!!", [])).toBe("tienda");
    expect(toSellerSlug("", [])).toBe("tienda");
  });

  it("limits the length and produces a valid slug", () => {
    const slug = toSellerSlug("a".repeat(100), []);
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("keeps the suffixed slug within the length limit", () => {
    const base = "a".repeat(100);
    const first = toSellerSlug(base, []);
    const second = toSellerSlug(base, [first]);
    expect(second).not.toBe(first);
    expect(second.length).toBeLessThanOrEqual(40);
  });
});
