import { describe, expect, it } from "vitest";
import { SELLER_PLAN } from "@/lib/seller/decide-subscription";
import { buildPurchaseRow, subscriptionGrantArgs } from "./fulfill-rows";

describe("buildPurchaseRow", () => {
  const base = { userId: "u1", bookId: "b1", provider: "mock", providerRef: "mock_1", amountCents: 1990000, currency: "COP" };

  it("keys the purchase by book and mirrors the legacy store id", () => {
    expect(buildPurchaseRow(base, "s1")).toEqual({
      user_id: "u1",
      book_id: "b1",
      store_id: "s1",
      provider: "mock",
      provider_ref: "mock_1",
      amount_cents: 1990000,
      currency: "COP",
    });
  });

  it("leaves store_id null for books that have no legacy store", () => {
    expect(buildPurchaseRow(base, null).store_id).toBeNull();
  });
});

describe("subscriptionGrantArgs", () => {
  it("maps the grant to the RPC arguments and always charges the server constant", () => {
    expect(subscriptionGrantArgs({ sellerId: "sel1", provider: "mock", providerRef: "mock_2" })).toEqual({
      p_seller: "sel1",
      p_provider: "mock",
      p_provider_ref: "mock_2",
      p_amount_cents: SELLER_PLAN.amountCents,
      p_currency: SELLER_PLAN.currency,
    });
  });

  it("ignores any amount smuggled into the input (R6)", () => {
    const args = subscriptionGrantArgs({ sellerId: "s", provider: "p", providerRef: "r", amountCents: 1 } as never);
    expect(args.p_amount_cents).toBe(SELLER_PLAN.amountCents);
  });
});
