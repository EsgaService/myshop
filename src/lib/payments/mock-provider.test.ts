import { describe, expect, it } from "vitest";
import { MockPaymentProvider } from "./mock-provider";
import { PaymentsDisabledError } from "./types";

const input = {
  userId: "user-1",
  storeId: "store-1",
  storeSlug: "cocteles",
  amountCents: 1990000,
  currency: "COP",
  payer: { name: "Anyone" },
};

describe("MockPaymentProvider", () => {
  it.each([undefined, "", "live", "production", "MOCK "])("rejects when PAYMENTS_MODE=%j", async (mode) => {
    const provider = new MockPaymentProvider(mode);
    await expect(provider.createCheckout(input)).rejects.toBeInstanceOf(PaymentsDisabledError);
  });

  it("confirms the payment whatever is typed when PAYMENTS_MODE=mock", async () => {
    const provider = new MockPaymentProvider("mock");
    const result = await provider.createCheckout({ ...input, payer: { name: "" }, extra: { card: "0000" } });
    expect(result.status).toBe("paid");
    expect(result.providerRef).toMatch(/^mock_/);
  });

  it("generates a distinct reference per checkout", async () => {
    const provider = new MockPaymentProvider("mock");
    const a = await provider.createCheckout(input);
    const b = await provider.createCheckout(input);
    expect(a.providerRef).not.toBe(b.providerRef);
  });

  it("identifies itself", () => {
    expect(new MockPaymentProvider("mock").id).toBe("mock");
  });
});
