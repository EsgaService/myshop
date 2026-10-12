import { describe, expect, it } from "vitest";
import { decideWebhookPurchase } from "./decide-webhook-purchase";

const book = { status: "published" as const, priceCents: 1_990_000, currency: "COP" };
const event = { amountCents: 1_990_000, currency: "COP" };
const ok = { book, event, sellerCanSell: true };

describe("decideWebhookPurchase", () => {
  it("grants when the paid amount covers the database price", () => {
    expect(decideWebhookPurchase(ok)).toEqual({ ok: true });
  });

  it("accepts an overpayment", () => {
    expect(decideWebhookPurchase({ ...ok, event: { ...event, amountCents: 2_500_000 } })).toEqual({ ok: true });
  });

  it("refuses an underpayment", () => {
    expect(decideWebhookPurchase({ ...ok, event: { ...event, amountCents: 1_989_999 } })).toEqual({
      ok: false,
      reason: "amount_mismatch",
    });
  });

  it("refuses a different currency even with a bigger number", () => {
    expect(decideWebhookPurchase({ ...ok, event: { amountCents: 99_000_000, currency: "USD" } })).toEqual({
      ok: false,
      reason: "currency_mismatch",
    });
  });

  it("refuses a missing book", () => {
    expect(decideWebhookPurchase({ ...ok, book: null })).toEqual({ ok: false, reason: "book_not_found" });
  });

  it("refuses unpublished books", () => {
    for (const status of ["draft", "archived"] as const) {
      expect(decideWebhookPurchase({ ...ok, book: { ...book, status } })).toEqual({ ok: false, reason: "book_unavailable" });
    }
  });

  it("refuses when the seller is not live", () => {
    expect(decideWebhookPurchase({ ...ok, sellerCanSell: false })).toEqual({ ok: false, reason: "book_unavailable" });
  });
});
