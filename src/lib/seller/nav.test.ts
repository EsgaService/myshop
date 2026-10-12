import { describe, expect, it } from "vitest";
import { sellerNav } from "./nav";

describe("sellerNav (R4, R10)", () => {
  it("lists dashboard, products, profile and subscription in order", () => {
    expect(sellerNav()).toEqual([
      { label: "Panel", href: "/vendedor" },
      { label: "Productos", href: "/vendedor/productos" },
      { label: "Perfil", href: "/vendedor/perfil" },
      { label: "Suscripción", href: "/vendedor/suscripcion" },
    ]);
  });

  it("never links to the marketplace or to buyer areas", () => {
    const hrefs = sellerNav().map((i) => i.href);
    expect(hrefs.every((h) => h.startsWith("/vendedor"))).toBe(true);
  });
});
