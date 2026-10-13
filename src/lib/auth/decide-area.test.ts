import { describe, expect, it } from "vitest";
import { decideArea } from "./decide-area";

describe("decideArea (R2)", () => {
  it("allows a role into its own area", () => {
    expect(decideArea({ role: "buyer", area: "buyer" })).toEqual({ kind: "allow" });
    expect(decideArea({ role: "seller", area: "seller" })).toEqual({ kind: "allow" });
  });

  it("sends anonymous users to the matching login screen", () => {
    expect(decideArea({ role: null, area: "buyer" })).toEqual({ kind: "redirect", to: "/ingresar" });
    expect(decideArea({ role: null, area: "seller" })).toEqual({ kind: "redirect", to: "/vendedor/ingresar" });
  });

  it("redirects a buyer away from the seller area", () => {
    expect(decideArea({ role: "buyer", area: "seller" })).toEqual({ kind: "redirect", to: "/mis-recetarios?aviso=rol" });
  });

  it("redirects a seller away from the buyer area", () => {
    expect(decideArea({ role: "seller", area: "buyer" })).toEqual({ kind: "redirect", to: "/vendedor?aviso=rol" });
  });
});
