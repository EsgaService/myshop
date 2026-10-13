import { describe, expect, it } from "vitest";
import { buildAccessInput } from "./book-context";

const book = { id: "b1", seller_id: "s1", slug: "cocteles", status: "published" as const, seller: { slug: "myshop" } };
const live = { canPublish: true, isListed: true, canSell: true };
const lapsed = { canPublish: false, isListed: false, canSell: false };

describe("buildAccessInput (R2, R8, R18)", () => {
  it("builds the public paths from seller and book slugs", () => {
    const input = buildAccessInput({ route: "landing", role: null, mySellerId: null, hasPurchase: false, book, sellerAccess: live });
    expect(input.paths).toEqual({ landing: "/myshop/cocteles", checkout: "/myshop/cocteles/pagar", book: "/myshop/cocteles/recetario" });
  });

  it("maps no role to anon and never grants ownership or a purchase", () => {
    const input = buildAccessInput({ route: "book", role: null, mySellerId: null, hasPurchase: true, book, sellerAccess: live });
    expect(input).toMatchObject({ viewer: "anon", hasPurchase: false, isOwner: false });
  });

  it("maps buyer to buyer and keeps the purchase flag", () => {
    const input = buildAccessInput({ route: "checkout", role: "buyer", mySellerId: null, hasPurchase: true, book, sellerAccess: live });
    expect(input).toMatchObject({ viewer: "buyer", hasPurchase: true, isOwner: false });
  });

  it("marks only the owning seller as owner", () => {
    const own = buildAccessInput({ route: "book", role: "seller", mySellerId: "s1", hasPurchase: false, book, sellerAccess: live });
    const other = buildAccessInput({ route: "book", role: "seller", mySellerId: "s2", hasPurchase: false, book, sellerAccess: live });
    expect(own).toMatchObject({ viewer: "seller", isOwner: true });
    expect(other).toMatchObject({ viewer: "seller", isOwner: false });
  });

  it("a seller never counts a purchase", () => {
    const input = buildAccessInput({ route: "checkout", role: "seller", mySellerId: "s2", hasPurchase: true, book, sellerAccess: live });
    expect(input.hasPurchase).toBe(false);
  });

  it("is sellable only when published and the seller may sell", () => {
    expect(buildAccessInput({ route: "landing", role: null, mySellerId: null, hasPurchase: false, book, sellerAccess: live }).sellable).toBe(true);
    expect(buildAccessInput({ route: "landing", role: null, mySellerId: null, hasPurchase: false, book, sellerAccess: lapsed }).sellable).toBe(false);
    expect(
      buildAccessInput({ route: "landing", role: null, mySellerId: null, hasPurchase: false, book: { ...book, status: "draft" }, sellerAccess: live }).sellable,
    ).toBe(false);
  });
});
