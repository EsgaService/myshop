import { describe, expect, it } from "vitest";
import { MAX_MANUAL_RETRIES, decideRetry, retryErrorMessage } from "./decide-retry";

describe("decideRetry (every retry re-bills the AI)", () => {
  it("allows a retry for a subscribed seller under the cap", () => {
    expect(decideRetry({ hasActiveSubscription: true, manualRetries: 0 })).toEqual({ ok: true });
    expect(decideRetry({ hasActiveSubscription: true, manualRetries: MAX_MANUAL_RETRIES - 1 })).toEqual({ ok: true });
  });

  it("caps manual retries per upload at 3", () => {
    expect(MAX_MANUAL_RETRIES).toBe(3);
    expect(decideRetry({ hasActiveSubscription: true, manualRetries: 3 })).toEqual({ ok: false, reason: "retry_limit" });
    expect(decideRetry({ hasActiveSubscription: true, manualRetries: 10 })).toEqual({ ok: false, reason: "retry_limit" });
  });

  it("requires a subscription before anything else", () => {
    expect(decideRetry({ hasActiveSubscription: false, manualRetries: 0 })).toEqual({ ok: false, reason: "subscription_required" });
    expect(decideRetry({ hasActiveSubscription: false, manualRetries: 5 })).toEqual({ ok: false, reason: "subscription_required" });
  });

  it("has Spanish messages", () => {
    expect(retryErrorMessage("subscription_required")).toMatch(/suscripci/i);
    expect(retryErrorMessage("retry_limit")).toMatch(/3/);
  });
});
