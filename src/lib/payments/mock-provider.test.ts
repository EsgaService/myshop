import { describe, expect, it } from "vitest";
import { MockPaymentProvider } from "./mock-provider";
import { PaymentsDisabledError } from "./types";

const input = {
  kind: "purchase" as const,
  userId: "user-1",
  subjectId: "book-1",
  amountCents: 1990000,
  currency: "COP",
  payer: { name: "Anyone" },
};

describe("MockPaymentProvider", () => {
  it.each([undefined, "", "live", "production", "MOCK "])("rejects when PAYMENTS_MODE=%j", async (mode) => {
    const provider = new MockPaymentProvider(mode, "development");
    await expect(provider.createCheckout(input)).rejects.toBeInstanceOf(PaymentsDisabledError);
  });

  it("confirms the payment whatever is typed when PAYMENTS_MODE=mock", async () => {
    const provider = new MockPaymentProvider("mock", "development");
    const result = await provider.createCheckout({ ...input, payer: { name: "" }, extra: { card: "0000" } });
    expect(result.status).toBe("paid");
    expect(result.providerRef).toMatch(/^mock_/);
  });

  it("confirms subscription checkouts too", async () => {
    const provider = new MockPaymentProvider("mock", "test");
    const result = await provider.createCheckout({ ...input, kind: "subscription", subjectId: "seller-1" });
    expect(result.status).toBe("paid");
  });

  it("generates a distinct reference per checkout", async () => {
    const provider = new MockPaymentProvider("mock", "development");
    const a = await provider.createCheckout(input);
    const b = await provider.createCheckout(input);
    expect(a.providerRef).not.toBe(b.providerRef);
  });

  it("refuses to charge in production even when PAYMENTS_MODE=mock", async () => {
    const provider = new MockPaymentProvider("mock", "production");
    await expect(provider.createCheckout(input)).rejects.toBeInstanceOf(PaymentsDisabledError);
  });

  it("identifies itself", () => {
    expect(new MockPaymentProvider("mock", "development").id).toBe("mock");
  });
});
