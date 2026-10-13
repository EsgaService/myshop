import { describe, expect, it } from "vitest";
import { decidePurchase } from "./decide-purchase";

const book = { status: "published" as const };
const live = { canPublish: true, isListed: true, canSell: true };
const lapsed = { canPublish: false, isListed: false, canSell: false };
const base = { role: "buyer" as const, book, sellerAccess: live, alreadyOwned: false };

describe("decidePurchase (R2, R8, R18)", () => {
  it("allows a buyer to buy a published book of a live seller", () => {
    expect(decidePurchase(base)).toEqual({ kind: "allow" });
  });

  it("requires login", () => {
    expect(decidePurchase({ ...base, role: null })).toMatchObject({ kind: "deny", status: 401 });
  });

  it("refuses sellers with 403 even for their own book", () => {
    expect(decidePurchase({ ...base, role: "seller" })).toMatchObject({ kind: "deny", status: 403 });
  });

  it("returns 404 when the book is not visible to the caller", () => {
    expect(decidePurchase({ ...base, book: null })).toMatchObject({ kind: "deny", status: 404 });
  });

  it("refuses drafts and lapsed sellers (no new sales)", () => {
    expect(decidePurchase({ ...base, book: { status: "draft" } })).toMatchObject({ kind: "deny", status: 409 });
    expect(decidePurchase({ ...base, sellerAccess: lapsed })).toMatchObject({ kind: "deny", status: 409 });
  });

  it("does not create a duplicate purchase for an owned book, even if the seller lapsed", () => {
    expect(decidePurchase({ ...base, alreadyOwned: true })).toEqual({ kind: "already-owned" });
    expect(decidePurchase({ ...base, alreadyOwned: true, sellerAccess: lapsed })).toEqual({ kind: "already-owned" });
  });

  it("checks the role before anything else", () => {
    expect(decidePurchase({ ...base, role: "seller", book: null, alreadyOwned: true })).toMatchObject({ status: 403 });
  });
});
