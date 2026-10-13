import { describe, expect, it } from "vitest";
import { buyerNav } from "./nav";

const owned = [
  { title: "Cócteles", slug: "cocteles", seller: { slug: "myshop" } },
  { title: "Tortas", slug: "tortas", seller: { slug: "ana" } },
];

describe("buyerNav (R16)", () => {
  it("lists each owned book linking to its reader", () => {
    const { nav } = buyerNav(owned);
    expect(nav).toContainEqual({ label: "Cócteles", href: "/myshop/cocteles/recetario" });
    expect(nav).toContainEqual({ label: "Tortas", href: "/ana/tortas/recetario" });
  });

  it("links to the profile", () => {
    expect(buyerNav(owned).nav).toContainEqual({ label: "Perfil", href: "/mis-recetarios/perfil" });
  });

  it("puts the marketplace CTA at the bottom, separate from the list", () => {
    const { nav, footerLink } = buyerNav(owned);
    expect(footerLink).toEqual({ label: "Obtener más recetas", href: "/explorar" });
    expect(nav.some((i) => i.href === "/explorar")).toBe(false);
  });

  it("still offers the library, profile and CTA with no purchases", () => {
    const { nav, footerLink } = buyerNav([]);
    expect(nav.map((i) => i.href)).toEqual(["/mis-recetarios", "/mis-recetarios/perfil"]);
    expect(footerLink.href).toBe("/explorar");
  });
});
