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
