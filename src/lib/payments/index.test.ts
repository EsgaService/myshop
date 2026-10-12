import { describe, expect, it } from "vitest";
import { getPaymentProvider, PaymentsDisabledError } from "./index";

describe("getPaymentProvider", () => {
  it.each(["development", "test", undefined])("returns the mock provider in %j", (nodeEnv) => {
    expect(getPaymentProvider("mock", nodeEnv).id).toBe("mock");
  });

  it("refuses mock mode in production (R19)", () => {
    expect(() => getPaymentProvider("mock", "production")).toThrow(PaymentsDisabledError);
  });

  it.each([undefined, "", "live"])("throws when no provider is configured (%j)", (mode) => {
    expect(() => getPaymentProvider(mode, "development")).toThrow(PaymentsDisabledError);
  });
});
