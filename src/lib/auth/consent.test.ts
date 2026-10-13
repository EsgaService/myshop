import { describe, expect, it } from "vitest";
import { CONSENT, canStartLogin } from "./consent";

describe("canStartLogin", () => {
  it("blocks sign-in until the terms are accepted", () => {
    expect(canStartLogin(false)).toBe(false);
  });
  it("allows sign-in once accepted", () => {
    expect(canStartLogin(true)).toBe(true);
  });
});

describe("CONSENT", () => {
  it("points to the legal pages", () => {
    expect(CONSENT.terms).toEqual({ label: "Términos y condiciones", href: "/terminos" });
    expect(CONSENT.privacy).toEqual({ label: "Política de privacidad", href: "/privacidad" });
  });
  it("has a neutral Spanish error message", () => {
    expect(CONSENT.error).toBe("Debes aceptar los términos para continuar");
  });
});
