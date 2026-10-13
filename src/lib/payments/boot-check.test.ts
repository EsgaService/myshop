import { describe, expect, it } from "vitest";
import { paymentsBootIssue } from "./boot-check";

describe("paymentsBootIssue", () => {
  it("flags mock payments in production (R19)", () => {
    expect(paymentsBootIssue({ PAYMENTS_MODE: "mock", NODE_ENV: "production" })).toMatch(/mock/i);
  });
  it.each([
    { PAYMENTS_MODE: "mock", NODE_ENV: "development" },
    { PAYMENTS_MODE: "mock", NODE_ENV: "test" },
    { PAYMENTS_MODE: undefined, NODE_ENV: "production" },
    { PAYMENTS_MODE: "live", NODE_ENV: "production" },
  ])("is silent for %j", (env) => {
    expect(paymentsBootIssue(env)).toBeNull();
  });
});

describe("paymentsBootIssue (wompi)", () => {
  const prod = {
    PAYMENTS_MODE: "wompi",
    NODE_ENV: "production",
    NEXT_PUBLIC_SITE_URL: "https://shop.test",
    WOMPI_PUBLIC_KEY: "pub_prod_a",
    WOMPI_PRIVATE_KEY: "prv_prod_b",
    WOMPI_EVENTS_SECRET: "prod_events_c",
    WOMPI_INTEGRITY_SECRET: "prod_integrity_d",
  };

  it("is silent with complete production keys", () => {
    expect(paymentsBootIssue(prod)).toBeNull();
  });

  it("flags missing keys in production", () => {
    expect(paymentsBootIssue({ ...prod, WOMPI_EVENTS_SECRET: "" })).toMatch(/WOMPI_EVENTS_SECRET/);
  });

  it("flags sandbox keys in production", () => {
    const issue = paymentsBootIssue({
      ...prod,
      WOMPI_PUBLIC_KEY: "pub_test_a",
      WOMPI_PRIVATE_KEY: "prv_test_b",
      WOMPI_EVENTS_SECRET: "test_events_c",
      WOMPI_INTEGRITY_SECRET: "test_integrity_d",
    });
    expect(issue).toMatch(/sandbox|test/i);
  });

  it("flags mixed keys", () => {
    expect(paymentsBootIssue({ ...prod, WOMPI_INTEGRITY_SECRET: "test_integrity_d" })).toMatch(/mix/i);
  });

  it("flags a missing public site URL in production (the return page needs it)", () => {
    expect(paymentsBootIssue({ ...prod, NEXT_PUBLIC_SITE_URL: "" })).toMatch(/NEXT_PUBLIC_SITE_URL/);
  });

  it("allows sandbox keys in development and never prints secrets", () => {
    const dev = { PAYMENTS_MODE: "wompi", NODE_ENV: "development", WOMPI_PUBLIC_KEY: "pub_test_a", WOMPI_PRIVATE_KEY: "prv_test_b", WOMPI_EVENTS_SECRET: "test_events_c", WOMPI_INTEGRITY_SECRET: "test_integrity_d" };
    expect(paymentsBootIssue(dev)).toBeNull();
    const issue = paymentsBootIssue({ ...dev, WOMPI_INTEGRITY_SECRET: "prod_integrity_SECRETVALUE" });
    expect(issue).not.toMatch(/SECRETVALUE/);
  });
});

