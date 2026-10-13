import { describe, expect, it } from "vitest";
import { decideAccess, type AccessInput } from "./decide-access";

const paths = { landing: "/ana/tacos", checkout: "/ana/tacos/pagar", book: "/ana/tacos/recetario" };
const base: Omit<AccessInput, "route"> = { paths, viewer: "anon", hasPurchase: false, isOwner: false, sellable: true };
const run = (route: AccessInput["route"], over: Partial<AccessInput> = {}) => decideAccess({ ...base, route, ...over });

describe("decideAccess on the product page", () => {
  it("shows the sales page to anonymous visitors, sellers and buyers without purchase", () => {
    expect(run("landing")).toEqual({ kind: "allow" });
    expect(run("landing", { viewer: "buyer" })).toEqual({ kind: "allow" });
    expect(run("landing", { viewer: "seller" })).toEqual({ kind: "allow" });
  });
  it("sends buyers with a purchase to the book", () => {
    expect(run("landing", { viewer: "buyer", hasPurchase: true })).toEqual({ kind: "redirect", to: paths.book });
  });
  it("still sends prior buyers to the book when the seller lapsed (R8)", () => {
    expect(run("landing", { viewer: "buyer", hasPurchase: true, sellable: false })).toEqual({ kind: "redirect", to: paths.book });
  });
  it("lets the owner see the page", () => {
    expect(run("landing", { viewer: "seller", isOwner: true })).toEqual({ kind: "allow" });
  });
  it("ignores a purchase flag for anonymous viewers", () => {
    expect(run("landing", { hasPurchase: true })).toEqual({ kind: "allow" });
  });
});

describe("decideAccess on checkout", () => {
  it("sends anonymous users to the buyer sign-up screen preserving next (R18)", () => {
    expect(run("checkout")).toEqual({ kind: "redirect", to: "/ingresar?modo=crear&next=%2Fana%2Ftacos%2Fpagar" });
  });
  it("refuses sellers (R2)", () => {
    expect(run("checkout", { viewer: "seller" })).toEqual({ kind: "redirect", to: `${paths.landing}?aviso=vendedor` });
    expect(run("checkout", { viewer: "seller", isOwner: true })).toEqual({ kind: "redirect", to: `${paths.landing}?aviso=vendedor` });
  });
  it("allows buyers without purchase on a sellable book", () => {
    expect(run("checkout", { viewer: "buyer" })).toEqual({ kind: "allow" });
  });
  it("does not charge twice: owners of the book go to it", () => {
    expect(run("checkout", { viewer: "buyer", hasPurchase: true })).toEqual({ kind: "redirect", to: paths.book });
  });
  it("blocks new sales when the seller is not sellable (R8)", () => {
    expect(run("checkout", { viewer: "buyer", sellable: false })).toEqual({ kind: "redirect", to: paths.landing });
  });
  it("still sends anonymous users to login even if not sellable", () => {
    expect(run("checkout", { sellable: false }).kind).toBe("redirect");
  });
});

describe("decideAccess on the book", () => {
  it("sends anonymous users to the sales page", () => {
    expect(run("book")).toEqual({ kind: "redirect", to: paths.landing });
    expect(run("book", { hasPurchase: true })).toEqual({ kind: "redirect", to: paths.landing });
  });
  it("sends buyers without purchase to checkout", () => {
    expect(run("book", { viewer: "buyer" })).toEqual({ kind: "redirect", to: paths.checkout });
  });
  it("allows buyers with a purchase, even if the seller lapsed (R8)", () => {
    expect(run("book", { viewer: "buyer", hasPurchase: true })).toEqual({ kind: "allow" });
    expect(run("book", { viewer: "buyer", hasPurchase: true, sellable: false })).toEqual({ kind: "allow" });
  });
  it("allows the owning seller as preview, drafts included", () => {
    expect(run("book", { viewer: "seller", isOwner: true })).toEqual({ kind: "allow" });
  });
  it("refuses other sellers", () => {
    expect(run("book", { viewer: "seller" })).toEqual({ kind: "redirect", to: paths.landing });
  });
});
