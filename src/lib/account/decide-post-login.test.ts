import { describe, expect, it } from "vitest";
import { decidePostLogin, roleHome } from "./decide-post-login";

describe("roleHome", () => {
  it("maps roles to their home", () => {
    expect(roleHome("buyer")).toBe("/mis-recetarios");
    expect(roleHome("seller")).toBe("/vendedor");
  });
});

describe("decidePostLogin (R1, R18)", () => {
  it("sends users to their role home when there is no next", () => {
    expect(decidePostLogin({ role: "buyer", next: null, mismatch: false })).toBe("/mis-recetarios");
    expect(decidePostLogin({ role: "seller", next: undefined, mismatch: false })).toBe("/vendedor");
  });

  it("rejects unsafe next values", () => {
    for (const next of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "evil"]) {
      expect(decidePostLogin({ role: "buyer", next, mismatch: false })).toBe("/mis-recetarios");
    }
  });

  it("honors a safe same-origin next for buyers (share-link checkout flow)", () => {
    expect(decidePostLogin({ role: "buyer", next: "/ana/tacos/pagar", mismatch: false })).toBe("/ana/tacos/pagar");
  });

  it("keeps buyers out of seller routes", () => {
    expect(decidePostLogin({ role: "buyer", next: "/vendedor/productos", mismatch: false })).toBe("/mis-recetarios");
    expect(decidePostLogin({ role: "buyer", next: "/vendedor", mismatch: false })).toBe("/mis-recetarios");
  });

  it("keeps sellers out of buyer-only routes (library and checkout)", () => {
    expect(decidePostLogin({ role: "seller", next: "/mis-recetarios", mismatch: false })).toBe("/vendedor");
    expect(decidePostLogin({ role: "seller", next: "/ana/tacos/pagar", mismatch: false })).toBe("/vendedor");
  });

  it("allows sellers to follow public or seller next paths", () => {
    expect(decidePostLogin({ role: "seller", next: "/vendedor/productos", mismatch: false })).toBe("/vendedor/productos");
    expect(decidePostLogin({ role: "seller", next: "/explorar", mismatch: false })).toBe("/explorar");
  });

  it("goes to the role home with a notice on role mismatch and ignores next", () => {
    expect(decidePostLogin({ role: "buyer", next: "/ana/tacos/pagar", mismatch: true })).toBe("/mis-recetarios?aviso=rol");
    expect(decidePostLogin({ role: "seller", next: "/x", mismatch: true })).toBe("/vendedor?aviso=rol");
  });
});
