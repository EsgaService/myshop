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

  it("titles each mode", () => {
    expect(authScreen("buyer", "ingresar").title).toBe("Inicia sesión");
    expect(authScreen("buyer", "crear").title).toBe("Crea tu cuenta");
    expect(authScreen("seller", "crear").title).toBe("Crea tu cuenta de vendedor");
  });

  it("only asks for the terms when creating an account", () => {
    expect(authScreen("buyer", "ingresar").requiresConsent).toBe(false);
    expect(authScreen("seller", "ingresar").requiresConsent).toBe(false);
    expect(authScreen("buyer", "crear").requiresConsent).toBe(true);
    expect(authScreen("seller", "crear").requiresConsent).toBe(true);
  });

  it("explains that roles are separate in both modes", () => {
    for (const role of ["buyer", "seller"] as const) {
      expect(authScreen(role, "crear").note.toLowerCase()).toContain("distintas");
      expect(authScreen(role, "ingresar").note.toLowerCase()).toContain("distintas");
    }
  });

  it("links to the other role screen keeping the mode", () => {
    expect(authScreen("buyer").switchLink.href).toBe("/vendedor/ingresar");
    expect(authScreen("seller").switchLink.href).toBe("/ingresar");
    expect(authScreen("buyer", "crear").switchLink.href).toBe("/vendedor/ingresar?modo=crear");
    expect(authScreen("seller", "crear").switchLink.href).toBe("/ingresar?modo=crear");
  });

  it("links to the opposite mode of the same screen, preserving next", () => {
    expect(authScreen("buyer", "ingresar").modeLink).toEqual({ label: "¿No tienes cuenta? Crea una", href: "/ingresar?modo=crear" });
    expect(authScreen("buyer", "crear").modeLink).toEqual({ label: "¿Ya tienes cuenta? Inicia sesión", href: "/ingresar" });
    expect(authScreen("seller", "crear", "/x").modeLink.href).toBe("/vendedor/ingresar?next=%2Fx");
    expect(authScreen("seller", "ingresar", "/x").modeLink.href).toBe("/vendedor/ingresar?modo=crear&next=%2Fx");
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

  it("explains why the account was not created when the terms were skipped", () => {
    expect(avisoMessage("crear-cuenta", null)).toBe("Aún no tienes cuenta. Acepta los términos para crearla.");
  });

  it("ignores unknown codes", () => {
    expect(avisoMessage("x", "buyer")).toBeNull();
    expect(avisoMessage(undefined, "buyer")).toBeNull();
  });
});
