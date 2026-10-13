import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS, isReservedSlug } from "./reserved-slugs";

describe("isReservedSlug", () => {
  it.each([
    "api", "auth", "login", "ingresar", "vendedor", "mis-recetarios", "explorar",
    "privacidad", "terminos", "admin", "ayuda", "precios", "myshop", "cocteles", "micheladas", "pagos",
  ])("reserves %s", (slug) => {
    expect(isReservedSlug(slug)).toBe(true);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(isReservedSlug("  Vendedor ")).toBe(true);
    expect(isReservedSlug("ADMIN")).toBe(true);
  });

  it.each(["panaderia-lola", "recetas", "api-fans", ""])("allows %s", (slug) => {
    expect(isReservedSlug(slug)).toBe(false);
  });

  it("exposes a frozen list of 16 entries", () => {
    expect(RESERVED_SLUGS).toHaveLength(16);
    expect(Object.isFrozen(RESERVED_SLUGS)).toBe(true);
  });
});
