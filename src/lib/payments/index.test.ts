import { describe, expect, it } from "vitest";
import { getPaymentProvider, PaymentsDisabledError, tryGetPaymentProvider } from "./index";

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

describe("tryGetPaymentProvider", () => {
  it("returns the provider when it is allowed", () => {
    expect(tryGetPaymentProvider("mock", "development")?.id).toBe("mock");
  });

  it("returns null instead of throwing for mock in production (R19) or an unconfigured mode", () => {
    expect(tryGetPaymentProvider("mock", "production")).toBeNull();
    expect(tryGetPaymentProvider(undefined, "development")).toBeNull();
  });
});
