import { describe, expect, it } from "vitest";
import { decideAccess } from "./decide-access";

const base = { slug: "cocteles" };

describe("decideAccess on the store landing (/[store])", () => {
  it("shows the public sales page to anonymous visitors", () => {
    expect(decideAccess({ ...base, route: "landing", isAuthenticated: false, hasPurchase: false })).toEqual({ kind: "allow" });
  });
  it("sends logged-in users without purchase straight to checkout", () => {
    expect(decideAccess({ ...base, route: "landing", isAuthenticated: true, hasPurchase: false })).toEqual({ kind: "redirect", to: "/cocteles/pagar" });
  });
  it("sends buyers to the book", () => {
    expect(decideAccess({ ...base, route: "landing", isAuthenticated: true, hasPurchase: true })).toEqual({ kind: "redirect", to: "/cocteles/recetario" });
  });
});

describe("decideAccess on checkout (/[store]/pagar)", () => {
  it("sends anonymous users to the sales page to log in", () => {
    expect(decideAccess({ ...base, route: "checkout", isAuthenticated: false, hasPurchase: false })).toEqual({ kind: "redirect", to: "/cocteles" });
  });
  it("allows logged-in users without purchase", () => {
    expect(decideAccess({ ...base, route: "checkout", isAuthenticated: true, hasPurchase: false })).toEqual({ kind: "allow" });
  });
  it("does not charge twice: buyers go to the book", () => {
    expect(decideAccess({ ...base, route: "checkout", isAuthenticated: true, hasPurchase: true })).toEqual({ kind: "redirect", to: "/cocteles/recetario" });
  });
});

describe("decideAccess on the book (/[store]/recetario)", () => {
  it("sends anonymous users to the sales page", () => {
    expect(decideAccess({ ...base, route: "book", isAuthenticated: false, hasPurchase: false })).toEqual({ kind: "redirect", to: "/cocteles" });
  });
  it("sends logged-in users without purchase to checkout", () => {
    expect(decideAccess({ ...base, route: "book", isAuthenticated: true, hasPurchase: false })).toEqual({ kind: "redirect", to: "/cocteles/pagar" });
  });
  it("allows buyers", () => {
    expect(decideAccess({ ...base, route: "book", isAuthenticated: true, hasPurchase: true })).toEqual({ kind: "allow" });
  });
  it("never trusts a purchase flag for an anonymous user", () => {
    expect(decideAccess({ ...base, route: "book", isAuthenticated: false, hasPurchase: true })).toEqual({ kind: "redirect", to: "/cocteles" });
  });
});
