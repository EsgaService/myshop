import { describe, expect, it, vi } from "vitest";
import type { CheckoutRecord, CheckoutStore } from "../checkout-types";
import { reconcileWompiTransaction } from "./reconcile";
import type { FetchTransactionResult } from "./client";

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

function setup(
  over: {
    fetched?: FetchTransactionResult;
    record?: CheckoutRecord | null;
    known?: CheckoutRecord | null;
    hasCheckouts?: boolean;
    allow?: boolean;
    apply?: { ok: true } | { ok: false; reason: string };
  } = {},
) {
  const store = {
    create: vi.fn(async () => {}),
    findByReference: vi.fn(async () => (over.record === undefined ? checkout : over.record)),
    recordOutcome: vi.fn(async () => {}),
    findReusablePending: vi.fn(async () => null),
    findByUserAndTransaction: vi.fn(async () => over.known ?? null),
    userHasCheckouts: vi.fn(async () => over.hasCheckouts ?? true),
  } satisfies CheckoutStore;
  const deps = {
    configEnvironment: "test" as const,
    store,
    allow: vi.fn(() => over.allow ?? true),
    fetchTransaction: vi.fn(async () => over.fetched ?? ({ ok: true, transaction: tx } as FetchTransactionResult)),
    apply: vi.fn(async () => over.apply ?? ({ ok: true } as const)),
  };
  return { store, deps };
}

describe("reconcileWompiTransaction", () => {
  it("fulfills an approved transaction that matches the stored checkout, then records the outcome", async () => {
    const { store, deps } = setup();
    const r = await reconcileWompiTransaction(deps, { transactionId: "tx-1", userId: "user-1" });
    expect(r).toEqual({ state: "approved", kind: "purchase", subjectId: "book-1" });
    expect(deps.apply).toHaveBeenCalledWith(expect.objectContaining({ type: "payment.succeeded", providerRef: "mys-p-abc", userId: "user-1" }));
    expect(store.recordOutcome).toHaveBeenCalledWith("mys-p-abc", { status: "approved", providerTransactionId: "tx-1" });
    // fulfill happens before the record says approved
    expect(deps.apply.mock.invocationCallOrder[0]).toBeLessThan(store.recordOutcome.mock.invocationCallOrder[0]);
  });

  it("is idempotent: running twice applies the same event keyed by the same reference", async () => {
    const { deps } = setup();
    await reconcileWompiTransaction(deps, { transactionId: "tx-1", userId: "user-1" });
    await reconcileWompiTransaction(deps, { transactionId: "tx-1", userId: "user-1" });
    const refs = deps.apply.mock.calls.map((c) => (c as unknown as [{ providerRef: string }])[0].providerRef);
    expect(new Set(refs)).toEqual(new Set(["mys-p-abc"]));
  });

  it("answers unknown when Wompi does not know the transaction", async () => {
    const { deps } = setup({ fetched: { ok: false, reason: "not_found" } });
    expect(await reconcileWompiTransaction(deps, { transactionId: "tx-1", userId: "user-1" })).toEqual({ state: "unknown" });
    expect(deps.apply).not.toHaveBeenCalled();
  });

  it("answers unavailable (retry later) when Wompi cannot be reached", async () => {
    const { deps } = setup({ fetched: { ok: false, reason: "unavailable" } });
    expect(await reconcileWompiTransaction(deps, { transactionId: "tx-1", userId: "user-1" })).toEqual({ state: "unavailable" });
  });

  it("answers unknown when the reference is not ours or belongs to another user", async () => {
    const none = setup({ record: null });
    expect(await reconcileWompiTransaction(none.deps, { transactionId: "tx-1", userId: "user-1" })).toEqual({ state: "unknown" });
    const other = setup();
    expect(await reconcileWompiTransaction(other.deps, { transactionId: "tx-1", userId: "someone-else" })).toEqual({ state: "unknown" });
    expect(other.deps.apply).not.toHaveBeenCalled();
    expect(other.store.recordOutcome).not.toHaveBeenCalled();
  });

  it("stays pending while the transaction is pending", async () => {
    const { deps, store } = setup({ fetched: { ok: true, transaction: { ...tx, status: "PENDING" } } });
    expect(await reconcileWompiTransaction(deps, { transactionId: "tx-1", userId: "user-1" })).toEqual({ state: "pending", kind: "purchase", subjectId: "book-1" });
    expect(deps.apply).not.toHaveBeenCalled();
    expect(store.recordOutcome).not.toHaveBeenCalled();
  });

  it("reports declined and records it without fulfilling", async () => {
    const { deps, store } = setup({ fetched: { ok: true, transaction: { ...tx, status: "DECLINED" } } });
    expect(await reconcileWompiTransaction(deps, { transactionId: "tx-1", userId: "user-1" })).toEqual({ state: "declined", kind: "purchase", subjectId: "book-1" });
    expect(store.recordOutcome).toHaveBeenCalledWith("mys-p-abc", { status: "declined", providerTransactionId: "tx-1" });
    expect(deps.apply).not.toHaveBeenCalled();
  });

  it("reports a problem on an amount mismatch of an APPROVED transaction and never fulfills", async () => {
    const { deps, store } = setup({ fetched: { ok: true, transaction: { ...tx, amountInCents: 100 } } });
    expect(await reconcileWompiTransaction(deps, { transactionId: "tx-1", userId: "user-1" })).toEqual({ state: "problem", kind: "purchase", subjectId: "book-1" });
    expect(deps.apply).not.toHaveBeenCalled();
    expect(store.recordOutcome).not.toHaveBeenCalled();
  });

  it("reports declined (not a problem) when a DECLINED transaction has a different amount", async () => {
    const { deps } = setup({ fetched: { ok: true, transaction: { ...tx, status: "DECLINED", amountInCents: 100 } } });
    expect(await reconcileWompiTransaction(deps, { transactionId: "tx-1", userId: "user-1" })).toEqual({ state: "declined", kind: "purchase", subjectId: "book-1" });
  });

  it("records the real status of a voided transaction", async () => {
    const { deps, store } = setup({ fetched: { ok: true, transaction: { ...tx, status: "VOIDED" } } });
    await reconcileWompiTransaction(deps, { transactionId: "tx-1", userId: "user-1" });
    expect(store.recordOutcome).toHaveBeenCalledWith("mys-p-abc", { status: "voided", providerTransactionId: "tx-1" });
  });

  it("flags approved_unfulfilled when fulfillment is impossible, so support can refund", async () => {
    const { deps, store } = setup({ apply: { ok: false, reason: "book_archived" } });
    const r = await reconcileWompiTransaction(deps, { transactionId: "tx-1", userId: "user-1" });
    expect(r).toEqual({ state: "unfulfilled", kind: "purchase", subjectId: "book-1" });
    expect(store.recordOutcome).toHaveBeenCalledWith("mys-p-abc", { status: "approved_unfulfilled", providerTransactionId: "tx-1" });
  });

  it("answers from our own record, without calling Wompi, when the webhook already settled this transaction for the user", async () => {
    const known = setup({ known: { ...checkout, status: "approved", providerTransactionId: "tx-1" } });
    expect(await reconcileWompiTransaction(known.deps, { transactionId: "tx-1", userId: "user-1" })).toEqual({ state: "approved", kind: "purchase", subjectId: "book-1" });
    expect(known.deps.fetchTransaction).not.toHaveBeenCalled();
    const unfulfilled = setup({ known: { ...checkout, status: "approved_unfulfilled", providerTransactionId: "tx-1" } });
    expect(await reconcileWompiTransaction(unfulfilled.deps, { transactionId: "tx-1", userId: "user-1" })).toMatchObject({ state: "unfulfilled" });
  });

  it("does not call Wompi for a user who never started a checkout", async () => {
    const { deps } = setup({ hasCheckouts: false });
    expect(await reconcileWompiTransaction(deps, { transactionId: "tx-1", userId: "user-1" })).toEqual({ state: "unknown" });
    expect(deps.fetchTransaction).not.toHaveBeenCalled();
  });

  it("does not call Wompi when the user is over the rate limit", async () => {
    const { deps } = setup({ allow: false });
    expect(await reconcileWompiTransaction(deps, { transactionId: "tx-1", userId: "user-1" })).toEqual({ state: "unavailable" });
    expect(deps.fetchTransaction).not.toHaveBeenCalled();
  });
});
