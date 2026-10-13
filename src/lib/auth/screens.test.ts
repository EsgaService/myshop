import { describe, expect, it } from "vitest";
import { authScreen, avisoMessage, wrongScreenRedirect } from "./screens";

describe("authScreen (R3)", () => {
  it("buyer and seller screens have different headlines and value props", () => {
    const buyer = authScreen("buyer");
    const seller = authScreen("seller");
    expect(buyer.title).not.toBe(seller.title);
    expect(buyer.text).not.toBe(seller.text);
    expect(buyer.title.length).toBeGreaterThan(0);
    expect(seller.text.toLowerCase()).toMatch(/vend|pdf|tienda/);
  });

  it("records the origin screen as the signup intent and has a role-appropriate default destination", () => {
    expect(authScreen("buyer")).toMatchObject({ as: "buyer", defaultNext: "/mis-recetarios" });
    expect(authScreen("seller")).toMatchObject({ as: "seller", defaultNext: "/vendedor" });
  });

  it("explains that the account is created automatically and that roles are separate", () => {
    for (const role of ["buyer", "seller"] as const) {
      expect(authScreen(role).note.toLowerCase()).toContain("automáticamente");
    }
  });

  it("links to the other screen", () => {
    expect(authScreen("buyer").switchLink.href).toBe("/vendedor/ingresar");
    expect(authScreen("seller").switchLink.href).toBe("/ingresar");
  });
});

describe("wrongScreenRedirect (R1)", () => {
  it("sends a logged-in user to their own home with a role notice when the screen does not match", () => {
    expect(wrongScreenRedirect({ role: "buyer", screen: "seller" })).toBe("/mis-recetarios?aviso=rol");
    expect(wrongScreenRedirect({ role: "seller", screen: "buyer" })).toBe("/vendedor?aviso=rol");
  });

  it("returns null when the role matches the screen", () => {
    expect(wrongScreenRedirect({ role: "buyer", screen: "buyer" })).toBeNull();
    expect(wrongScreenRedirect({ role: "seller", screen: "seller" })).toBeNull();
    expect(wrongScreenRedirect({ role: null, screen: "seller" })).toBeNull();
  });
});

describe("avisoMessage", () => {
  it("explains the role refusal for each role without offering a role change", () => {
    const buyer = avisoMessage("rol", "buyer");
    const seller = avisoMessage("rol", "seller");
    expect(buyer).toMatch(/comprador/i);
    expect(seller).toMatch(/vendedor/i);
    expect(buyer).not.toBe(seller);
  });

  it("explains that sellers cannot buy", () => {
    expect(avisoMessage("vendedor", "seller")).toMatch(/no puedes comprar/i);
  });

  it("ignores unknown codes", () => {
    expect(avisoMessage("x", "buyer")).toBeNull();
    expect(avisoMessage(undefined, "buyer")).toBeNull();
  });
});
