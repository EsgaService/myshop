import { describe, expect, it, vi } from "vitest";
import { PaymentsDisabledError, type CheckoutInput, type PaymentProvider } from "@/lib/payments/types";
import { runSubscribe } from "./subscribe-core";

function provider(result: Awaited<ReturnType<PaymentProvider["createCheckout"]>> | Error) {
  const createCheckout = vi.fn(async (_input: CheckoutInput) => {
    if (result instanceof Error) throw result;
    return result;
  });
  return { id: "mock", createCheckout } satisfies PaymentProvider;
}

const base = { userId: "user-1", sellerId: "seller-1", email: "a@b.co", siteUrl: "https://shop.test" };

describe("runSubscribe (R6)", () => {
  it("charges the server constant (50.000 COP) as a subscription for the seller", async () => {
    const p = provider({ status: "paid", providerRef: "mock_1" });
    const grant = vi.fn().mockResolvedValue(undefined);
    const r = await runSubscribe({ ...base, provider: p, grant });

    expect(r).toEqual({ ok: true });
    expect(p.createCheckout).toHaveBeenCalledTimes(1);
    expect(p.createCheckout.mock.calls[0][0]).toMatchObject({
      kind: "subscription",
      userId: "user-1",
      subjectId: "seller-1",
      amountCents: 5_000_000,
      currency: "COP",
    });
  });

  it("grants the period only after a paid result, with the provider reference", async () => {
    const grant = vi.fn().mockResolvedValue(undefined);
    await runSubscribe({ ...base, provider: provider({ status: "paid", providerRef: "mock_9" }), grant });
    expect(grant).toHaveBeenCalledWith({ sellerId: "seller-1", provider: "mock", providerRef: "mock_9" });
  });

  it("does not grant for hosted checkouts: access arrives with the verified webhook", async () => {
    const grant = vi.fn();
    const r = await runSubscribe({ ...base, provider: provider({ status: "redirect", providerRef: "x", url: "https://pay.test/c" }), grant });
    expect(r).toEqual({ ok: true, redirectTo: "https://pay.test/c" });
    expect(grant).not.toHaveBeenCalled();
  });

  it("refuses with a clear message when payments are disabled (e.g. mock in production)", async () => {
    const grant = vi.fn();
    const r = await runSubscribe({ ...base, provider: provider(new PaymentsDisabledError()), grant });
    expect(r).toMatchObject({ ok: false });
    expect(grant).not.toHaveBeenCalled();
  });

  it("refuses when there is no provider at all", async () => {
    const grant = vi.fn();
    const r = await runSubscribe({ ...base, provider: null, grant });
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/pagos/) });
    expect(grant).not.toHaveBeenCalled();
  });

  it("does not leak unexpected provider errors", async () => {
    const grant = vi.fn();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await runSubscribe({ ...base, provider: provider(new Error("secret gateway detail")), grant });
    spy.mockRestore();
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toMatch(/secret gateway detail/);
    expect(grant).not.toHaveBeenCalled();
  });

  it("has no amount parameter: a client-supplied amount cannot influence the charge", () => {
    // Compile-time guarantee: the input type has no amount. Extra runtime keys are ignored.
    const p = provider({ status: "paid", providerRef: "m" });
    return runSubscribe({ ...base, provider: p, grant: vi.fn(), amountCents: 1 } as never).then(() => {
      expect(p.createCheckout.mock.calls[0][0].amountCents).toBe(5_000_000);
    });
  });
});
