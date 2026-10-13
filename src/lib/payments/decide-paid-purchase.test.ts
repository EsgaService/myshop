import { describe, expect, it } from "vitest";
import { decidePaidPurchase } from "./decide-paid-purchase";

describe("decidePaidPurchase", () => {
  it.each(["draft", "published"] as const)("grants for a %s book: the buyer already paid the price agreed at checkout", (status) => {
    expect(decidePaidPurchase({ book: { status } })).toEqual({ ok: true });
  });

  it("refuses only when fulfillment is impossible: missing book", () => {
    expect(decidePaidPurchase({ book: null })).toEqual({ ok: false, reason: "book_not_found" });
  });

  it("refuses an archived book", () => {
    expect(decidePaidPurchase({ book: { status: "archived" } })).toEqual({ ok: false, reason: "book_archived" });
  });
});
