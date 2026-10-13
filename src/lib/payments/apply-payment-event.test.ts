import { describe, expect, it, vi } from "vitest";
import { applyPaymentEvent } from "./apply-payment-event";
import type { PaymentEvent } from "./types";

const purchase: PaymentEvent = {
  type: "payment.succeeded",
  kind: "purchase",
  subjectId: "book-1",
  providerRef: "mys-p-abc",
  userId: "user-1",
  amountCents: 500000,
  currency: "COP",
};
const subscription: PaymentEvent = { ...purchase, kind: "subscription", subjectId: "seller-1", providerRef: "mys-s-abc" };

function deps(book: { status: "draft" | "published" | "archived" } | null = { status: "published" }) {
  return {
    grantPurchase: vi.fn(async () => {}),
    grantSubscriptionPeriod: vi.fn(async () => {}),
    loadBookForWebhook: vi.fn(async () => ({ book })),
  };
}

describe("applyPaymentEvent", () => {
  it("grants a purchase at the amount stored on the checkout", async () => {
    const d = deps();
    expect(await applyPaymentEvent(purchase, "wompi", d)).toEqual({ ok: true });
    expect(d.grantPurchase).toHaveBeenCalledWith({
      userId: "user-1",
      bookId: "book-1",
      provider: "wompi",
      providerRef: "mys-p-abc",
      amountCents: 500000,
      currency: "COP",
    });
  });

  it("still grants when the book was unpublished or its price changed after checkout (the buyer already paid)", async () => {
    const d = deps({ status: "draft" });
    expect(await applyPaymentEvent(purchase, "wompi", d)).toEqual({ ok: true });
    expect(d.grantPurchase).toHaveBeenCalledTimes(1);
  });

  it("refuses only when fulfillment is impossible: book missing or archived", async () => {
    const missing = deps(null);
    expect(await applyPaymentEvent(purchase, "wompi", missing)).toEqual({ ok: false, reason: "book_not_found" });
    expect(missing.grantPurchase).not.toHaveBeenCalled();
    const archived = deps({ status: "archived" });
    expect(await applyPaymentEvent(purchase, "wompi", archived)).toEqual({ ok: false, reason: "book_archived" });
    expect(archived.grantPurchase).not.toHaveBeenCalled();
  });

  it("always grants an approved subscription period keyed by the provider reference", async () => {
    const d = deps(null);
    expect(await applyPaymentEvent(subscription, "wompi", d)).toEqual({ ok: true });
    expect(d.grantSubscriptionPeriod).toHaveBeenCalledWith({ sellerId: "seller-1", provider: "wompi", providerRef: "mys-s-abc" });
    expect(d.loadBookForWebhook).not.toHaveBeenCalled();
  });

  it.each(["payment.failed", "payment.refunded"] as const)("does nothing for %s (access is never auto-revoked)", async (type) => {
    const d = deps();
    expect(await applyPaymentEvent({ ...purchase, type }, "wompi", d)).toEqual({ ok: true });
    expect(d.grantPurchase).not.toHaveBeenCalled();
    expect(d.grantSubscriptionPeriod).not.toHaveBeenCalled();
  });

  it("lets grant errors propagate so the gateway retries", async () => {
    const d = deps();
    d.grantPurchase.mockRejectedValueOnce(new Error("db"));
    await expect(applyPaymentEvent(purchase, "wompi", d)).rejects.toThrow("db");
  });
});
