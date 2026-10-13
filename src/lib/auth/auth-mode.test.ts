import { describe, expect, it } from "vitest";
import { authPath, decideAccountCreation, parseAuthMode, signupRequiredPath } from "./auth-mode";

describe("parseAuthMode", () => {
  it("accepts only crear and defaults to ingresar", () => {
    expect(parseAuthMode("crear")).toBe("crear");
    expect(parseAuthMode("ingresar")).toBe("ingresar");
    expect(parseAuthMode(undefined)).toBe("ingresar");
    expect(parseAuthMode("")).toBe("ingresar");
    expect(parseAuthMode("admin")).toBe("ingresar");
    expect(parseAuthMode(["crear", "x"])).toBe("ingresar");
  });
});

describe("authPath", () => {
  it("builds the sign-in URL without a mode param", () => {
    expect(authPath("buyer", "ingresar")).toBe("/ingresar");
    expect(authPath("seller", "ingresar")).toBe("/vendedor/ingresar");
  });
  it("builds the sign-up URL", () => {
    expect(authPath("buyer", "crear")).toBe("/ingresar?modo=crear");
    expect(authPath("seller", "crear")).toBe("/vendedor/ingresar?modo=crear");
  });
  it("preserves and encodes next", () => {
    expect(authPath("buyer", "crear", { next: "/ana/tacos/pagar" })).toBe("/ingresar?modo=crear&next=%2Fana%2Ftacos%2Fpagar");
    expect(authPath("buyer", "ingresar", { next: "/ana/tacos/pagar" })).toBe("/ingresar?next=%2Fana%2Ftacos%2Fpagar");
  });
});

describe("decideAccountCreation", () => {
  it("signs in when a profile exists, ignoring consent", () => {
    expect(decideAccountCreation({ hasProfile: true, consent: null })).toBe("signin");
    expect(decideAccountCreation({ hasProfile: true, consent: "1" })).toBe("signin");
  });
  it("creates the account only with explicit consent", () => {
    expect(decideAccountCreation({ hasProfile: false, consent: "1" })).toBe("create");
    expect(decideAccountCreation({ hasProfile: false, consent: null })).toBe("requireSignup");
    expect(decideAccountCreation({ hasProfile: false, consent: undefined })).toBe("requireSignup");
    expect(decideAccountCreation({ hasProfile: false, consent: "0" })).toBe("requireSignup");
    expect(decideAccountCreation({ hasProfile: false, consent: "true" })).toBe("requireSignup");
  });
});

describe("signupRequiredPath", () => {
  it("returns to the matching sign-up screen with the notice", () => {
    expect(signupRequiredPath({ intent: "buyer", next: null })).toBe("/ingresar?modo=crear&aviso=crear-cuenta");
    expect(signupRequiredPath({ intent: "seller", next: null })).toBe("/vendedor/ingresar?modo=crear&aviso=crear-cuenta");
  });
  it("defaults forged intents to the buyer screen", () => {
    expect(signupRequiredPath({ intent: "admin", next: null })).toBe("/ingresar?modo=crear&aviso=crear-cuenta");
  });
  it("preserves a safe next and drops an unsafe one", () => {
    expect(signupRequiredPath({ intent: "buyer", next: "/ana/tacos/pagar" })).toBe(
      "/ingresar?modo=crear&aviso=crear-cuenta&next=%2Fana%2Ftacos%2Fpagar",
    );
    expect(signupRequiredPath({ intent: "buyer", next: "//evil.com" })).toBe("/ingresar?modo=crear&aviso=crear-cuenta");
  });
});
