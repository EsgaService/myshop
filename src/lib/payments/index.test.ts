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

const testKeys = {
  WOMPI_PUBLIC_KEY: "pub_test_a",
  WOMPI_PRIVATE_KEY: "prv_test_b",
  WOMPI_EVENTS_SECRET: "test_events_c",
  WOMPI_INTEGRITY_SECRET: "test_integrity_d",
};
const prodKeys = {
  WOMPI_PUBLIC_KEY: "pub_prod_a",
  WOMPI_PRIVATE_KEY: "prv_prod_b",
  WOMPI_EVENTS_SECRET: "prod_events_c",
  WOMPI_INTEGRITY_SECRET: "prod_integrity_d",
};

describe("getPaymentProvider (wompi)", () => {
  it("returns the Wompi provider with sandbox keys outside production", () => {
    expect(getPaymentProvider("wompi", "development", testKeys).id).toBe("wompi");
  });

  it("returns the Wompi provider with production keys in production", () => {
    expect(getPaymentProvider("wompi", "production", prodKeys).id).toBe("wompi");
  });

  it("refuses sandbox keys in production (sandbox approvals are not real money)", () => {
    expect(() => getPaymentProvider("wompi", "production", testKeys)).toThrow(PaymentsDisabledError);
  });

  it("refuses missing or mixed keys", () => {
    expect(() => getPaymentProvider("wompi", "development", {})).toThrow(PaymentsDisabledError);
    expect(() => getPaymentProvider("wompi", "development", { ...testKeys, WOMPI_INTEGRITY_SECRET: prodKeys.WOMPI_INTEGRITY_SECRET })).toThrow(
      PaymentsDisabledError,
    );
  });

  it("keeps the mock working in development", () => {
    expect(getPaymentProvider("mock", "development", {}).id).toBe("mock");
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
