import { describe, expect, it } from "vitest";
import type { CheckoutRecord } from "../checkout-types";
import { decideWompiTransaction } from "./decide-transaction";

const checkout: CheckoutRecord = {
  reference: "mys-p-abc",
  kind: "purchase",
  subjectId: "book-1",
  userId: "user-1",
  amountCents: 500000,
  currency: "COP",
  provider: "wompi",
  status: "pending",
  providerTransactionId: null,
  expiresAt: "2026-10-12T21:00:00.000Z",
};

const tx = { id: "tx-1", reference: "mys-p-abc", amountInCents: 500000, currency: "COP", status: "APPROVED" };

const base = { transaction: tx, checkout, configEnvironment: "test" as const, eventEnvironment: "test" as const };

describe("decideWompiTransaction", () => {
  it("turns an approved transaction matching the stored checkout into a succeeded event", () => {
    expect(decideWompiTransaction(base)).toEqual({
      kind: "event",
      event: {
        type: "payment.succeeded",
        kind: "purchase",
        subjectId: "book-1",
        providerRef: "mys-p-abc",
        userId: "user-1",
        amountCents: 500000,
        currency: "COP",
        providerTransactionId: "tx-1",
        gatewayStatus: "approved",
      },
    });
  });

  it("takes who/what/how much from our record, never from the event", () => {
    const r = decideWompiTransaction({ ...base, checkout: { ...checkout, kind: "subscription", subjectId: "seller-9", userId: "user-9" } });
    expect(r).toMatchObject({ kind: "event", event: { kind: "subscription", subjectId: "seller-9", userId: "user-9" } });
  });

  it("ignores an unknown reference (authentic but not ours)", () => {
    expect(decideWompiTransaction({ ...base, checkout: null })).toEqual({ kind: "ignored", reason: "unknown_reference" });
  });

  it("ignores a checkout created for another provider", () => {
    expect(decideWompiTransaction({ ...base, checkout: { ...checkout, provider: "mock" } })).toMatchObject({ kind: "ignored" });
  });

  it("rejects an amount that differs from the stored checkout", () => {
    expect(decideWompiTransaction({ ...base, transaction: { ...tx, amountInCents: 100 } })).toEqual({ kind: "rejected", reason: "amount_mismatch" });
    expect(decideWompiTransaction({ ...base, transaction: { ...tx, amountInCents: 900000 } })).toEqual({ kind: "rejected", reason: "amount_mismatch" });
  });

  it("rejects a currency that differs from the stored checkout", () => {
    expect(decideWompiTransaction({ ...base, transaction: { ...tx, currency: "USD" } })).toEqual({ kind: "rejected", reason: "currency_mismatch" });
  });

  it("rejects an event from another environment than the configured keys", () => {
    expect(decideWompiTransaction({ ...base, eventEnvironment: "prod" })).toEqual({ kind: "rejected", reason: "environment_mismatch" });
    expect(decideWompiTransaction({ ...base, configEnvironment: "prod" })).toEqual({ kind: "rejected", reason: "environment_mismatch" });
  });

  it("skips the environment check for transactions fetched from the API (no event environment)", () => {
    expect(decideWompiTransaction({ ...base, eventEnvironment: undefined })).toMatchObject({ kind: "event" });
  });

  it("ignores pending and unknown statuses", () => {
    expect(decideWompiTransaction({ ...base, transaction: { ...tx, status: "PENDING" } })).toEqual({ kind: "ignored", reason: "pending" });
    expect(decideWompiTransaction({ ...base, transaction: { ...tx, status: "WHATEVER" } })).toEqual({ kind: "ignored", reason: "pending" });
  });

  it.each([
    ["DECLINED", "payment.failed", "declined"],
    ["ERROR", "payment.failed", "error"],
    ["VOIDED", "payment.refunded", "voided"],
  ] as const)("carries the real status: %s -> %s (%s)", (status, type, gatewayStatus) => {
    expect(decideWompiTransaction({ ...base, transaction: { ...tx, status } })).toMatchObject({ kind: "event", event: { type, gatewayStatus } });
  });

  it("does not reject a DECLINED/VOIDED/ERROR transaction for an amount or currency mismatch: no money moved, only an approval is checked", () => {
    for (const status of ["DECLINED", "VOIDED", "ERROR"]) {
      expect(decideWompiTransaction({ ...base, transaction: { ...tx, status, amountInCents: 1 } })).toMatchObject({ kind: "event" });
      expect(decideWompiTransaction({ ...base, transaction: { ...tx, status, currency: "USD" } })).toMatchObject({ kind: "event" });
    }
  });

  it("still rejects an environment mismatch whatever the status", () => {
    expect(decideWompiTransaction({ ...base, eventEnvironment: "prod", transaction: { ...tx, status: "DECLINED" } })).toEqual({
      kind: "rejected",
      reason: "environment_mismatch",
    });
  });
});
