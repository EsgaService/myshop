import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { CheckoutRecord, CheckoutStore } from "../checkout-types";
import { PaymentsDisabledError } from "../types";
import type { FetchTransactionResult } from "./client";
import { parseWompiConfig } from "./config";
import { WompiPaymentProvider } from "./provider";
import { integritySignature } from "./signature";

const parsed = parseWompiConfig({
  WOMPI_PUBLIC_KEY: "pub_test_a",
  WOMPI_PRIVATE_KEY: "prv_test_b",
  WOMPI_EVENTS_SECRET: "test_events_c",
  WOMPI_INTEGRITY_SECRET: "test_integrity_d",
});
if (!parsed.ok) throw new Error("fixture");
const config = parsed.config;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const now = new Date("2026-10-12T20:00:00.000Z");

function makeStore(over: { existing?: CheckoutRecord | null; reusable?: CheckoutRecord | null } = {}) {
  const store = {
    create: vi.fn(async () => {}),
    findByReference: vi.fn(async () => over.existing ?? null),
    recordOutcome: vi.fn(async () => {}),
    findReusablePending: vi.fn(async () => over.reusable ?? null),
    findByUserAndTransaction: vi.fn(async () => null),
    userHasCheckouts: vi.fn(async () => true),
  } satisfies CheckoutStore;
  return store;
}

const apiTx = { id: "tx-1", reference: "mys-p-abc", amountInCents: 500000, currency: "COP", status: "APPROVED" };

function make(store: CheckoutStore, fetched: FetchTransactionResult | Error = { ok: true, transaction: apiTx }) {
  const fetchTransaction = vi.fn(async (_id: string) => {
    if (fetched instanceof Error) throw fetched;
    return fetched;
  });
  const provider = new WompiPaymentProvider({
    config,
    store,
    now: () => now,
    randomId: () => "11111111-2222-3333-4444-555555555555",
    fetchTransaction,
  });
  return { provider, fetchTransaction };
}

describe("WompiPaymentProvider.createCheckout", () => {
  const input = {
    kind: "purchase" as const,
    userId: "user-1",
    subjectId: "book-1",
    amountCents: 500000,
    currency: "COP",
    payer: { email: "a@b.co", name: "Ana" },
    returnUrl: "https://shop.test/ana/libro/recetario",
  };

  it("persists the checkout record, with its expiry, BEFORE returning the redirect URL", async () => {
    const store = makeStore();
    const { provider } = make(store);
    const r = await provider.createCheckout(input);
    expect(store.create).toHaveBeenCalledWith({
      reference: "mys-p-11111111222233334444555555555555",
      kind: "purchase",
      subjectId: "book-1",
      userId: "user-1",
      amountCents: 500000,
      currency: "COP",
      provider: "wompi",
      expiresAt: "2026-10-12T21:00:00.000Z",
    });
    expect(r.status).toBe("redirect");
  });

  it("returns the reference as providerRef and a signed hosted-checkout URL", async () => {
    const r = await make(makeStore()).provider.createCheckout(input);
    if (r.status !== "redirect") throw new Error("expected redirect");
    expect(r.providerRef).toBe("mys-p-11111111222233334444555555555555");
    const url = new URL(r.url);
    expect(url.origin).toBe("https://checkout.wompi.co");
    expect(url.searchParams.get("public-key")).toBe("pub_test_a");
    expect(url.searchParams.get("amount-in-cents")).toBe("500000");
    expect(url.searchParams.get("reference")).toBe(r.providerRef);
    expect(url.searchParams.get("customer-data:email")).toBe("a@b.co");
    expect(url.searchParams.get("redirect-url")).toBe("https://shop.test/pagos/resultado");
    const expiration = url.searchParams.get("expiration-time");
    expect(expiration).toBe("2026-10-12T21:00:00.000Z");
    expect(url.searchParams.get("signature:integrity")).toBe(
      integritySignature({ reference: r.providerRef, amountInCents: 500000, currency: "COP", expirationTime: expiration!, integritySecret: "test_integrity_d" }),
    );
    expect(r.url).not.toContain("test_integrity_d");
    expect(r.url).not.toContain("prv_test_b");
  });

  it("uses an s- reference and the subscription return path for subscriptions", async () => {
    const r = await make(makeStore()).provider.createCheckout({ ...input, kind: "subscription", returnUrl: "https://shop.test/vendedor/suscripcion" });
    if (r.status !== "redirect") throw new Error("expected redirect");
    expect(r.providerRef).toMatch(/^mys-s-/);
    expect(new URL(r.url).searchParams.get("redirect-url")).toBe("https://shop.test/pagos/resultado/suscripcion");
  });

  it("fails with a clear config error, and stores nothing, when no absolute return URL is available", async () => {
    for (const returnUrl of [undefined, "", "/ana/libro/recetario"]) {
      const store = makeStore();
      await expect(make(store).provider.createCheckout({ ...input, returnUrl })).rejects.toThrow(PaymentsDisabledError);
      await expect(make(store).provider.createCheckout({ ...input, returnUrl })).rejects.toThrow(/NEXT_PUBLIC_SITE_URL/);
      expect(store.create).not.toHaveBeenCalled();
    }
  });

  it("does not return a URL when the record could not be stored", async () => {
    const store = makeStore();
    store.create.mockRejectedValueOnce(new Error("db down"));
    await expect(make(store).provider.createCheckout(input)).rejects.toThrow();
  });

  it("reuses a still-valid pending checkout of the same user and subject (same URL, no second record)", async () => {
    const reusable: CheckoutRecord = {
      reference: "mys-p-old",
      kind: "purchase",
      subjectId: "book-1",
      userId: "user-1",
      amountCents: 500000,
      currency: "COP",
      provider: "wompi",
      status: "pending",
      providerTransactionId: null,
      expiresAt: "2026-10-12T20:45:00.000Z",
    };
    const store = makeStore({ reusable });
    const { provider } = make(store);
    const first = await provider.createCheckout(input);
    const second = await provider.createCheckout(input);
    if (first.status !== "redirect" || second.status !== "redirect") throw new Error("expected redirect");
    expect(first.providerRef).toBe("mys-p-old");
    expect(first.url).toBe(second.url);
    expect(new URL(first.url).searchParams.get("expiration-time")).toBe("2026-10-12T20:45:00.000Z");
    expect(store.create).not.toHaveBeenCalled();
    expect(store.findReusablePending).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", kind: "purchase", subjectId: "book-1", amountCents: 500000, currency: "COP", provider: "wompi" }),
    );
  });

  it("creates a new checkout when the candidate is about to expire", async () => {
    const stale = { reference: "mys-p-old", kind: "purchase", subjectId: "book-1", userId: "user-1", amountCents: 500000, currency: "COP", provider: "wompi", status: "pending", providerTransactionId: null, expiresAt: "2026-10-12T20:02:00.000Z" } as const;
    const store = makeStore({ reusable: stale });
    const r = await make(store).provider.createCheckout(input);
    expect(store.create).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ providerRef: "mys-p-11111111222233334444555555555555" });
  });
});

describe("WompiPaymentProvider.parseWebhook", () => {
  const record: CheckoutRecord = {
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

  function signed(over: { tx?: Record<string, unknown>; environment?: string; event?: string } = {}) {
    const transaction = {
      id: "tx-1",
      reference: "mys-p-abc",
      amount_in_cents: 500000,
      currency: "COP",
      status: "APPROVED",
      ...over.tx,
    };
    const timestamp = 1530291411;
    const body = {
      event: over.event ?? "transaction.updated",
      data: { transaction },
      environment: over.environment ?? "test",
      signature: {
        properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
        checksum: sha(`${transaction.id}${transaction.status}${transaction.amount_in_cents}${timestamp}test_events_c`),
      },
      timestamp,
      sent_at: "2026-10-12T20:00:00.000Z",
    };
    return { headers: new Headers({ "x-event-checksum": body.signature.checksum }), rawBody: JSON.stringify(body) };
  }

  it("yields a succeeded event for an authentic approved transaction matching our record and the API", async () => {
    const store = makeStore({ existing: record });
    const { provider, fetchTransaction } = make(store);
    const r = await provider.parseWebhook(signed());
    expect(fetchTransaction).toHaveBeenCalledWith("tx-1");
    expect(store.findByReference).toHaveBeenCalledWith("mys-p-abc");
    expect(r).toMatchObject({
      status: "event",
      event: { type: "payment.succeeded", gatewayStatus: "approved", kind: "purchase", subjectId: "book-1", userId: "user-1", providerRef: "mys-p-abc", amountCents: 500000, providerTransactionId: "tx-1" },
    });
  });

  it("trusts the API over the event body: an event claiming APPROVED while Wompi says DECLINED is not a payment", async () => {
    const { provider } = make(makeStore({ existing: record }), { ok: true, transaction: { ...apiTx, status: "DECLINED" } });
    expect(await provider.parseWebhook(signed())).toMatchObject({ status: "event", event: { type: "payment.failed", gatewayStatus: "declined" } });
  });

  it("rejects when the API amount differs from our record", async () => {
    const { provider } = make(makeStore({ existing: record }), { ok: true, transaction: { ...apiTx, amountInCents: 100 } });
    expect(await provider.parseWebhook(signed())).toEqual({ status: "rejected", reason: "amount_mismatch" });
  });

  it("rejects when the API reference differs from the event reference", async () => {
    const { provider } = make(makeStore({ existing: record }), { ok: true, transaction: { ...apiTx, reference: "mys-p-other" } });
    expect(await provider.parseWebhook(signed())).toEqual({ status: "rejected", reason: "reference_mismatch" });
  });

  it("rejects when Wompi does not know the transaction", async () => {
    const { provider } = make(makeStore({ existing: record }), { ok: false, reason: "not_found" });
    expect(await provider.parseWebhook(signed())).toEqual({ status: "rejected", reason: "transaction_not_found" });
  });

  it("throws (so Wompi retries) when the API is unavailable", async () => {
    const { provider } = make(makeStore({ existing: record }), { ok: false, reason: "unavailable" });
    await expect(provider.parseWebhook(signed())).rejects.toThrow();
  });

  it("answers invalid for a bad signature without touching the API or the database", async () => {
    const store = makeStore({ existing: record });
    const { provider, fetchTransaction } = make(store);
    const req = signed();
    const forged = JSON.parse(req.rawBody);
    forged.data.transaction.amount_in_cents = 1;
    const r = await provider.parseWebhook({ headers: req.headers, rawBody: JSON.stringify(forged) });
    expect(r).toEqual({ status: "invalid" });
    expect(fetchTransaction).not.toHaveBeenCalled();
    expect(store.findByReference).not.toHaveBeenCalled();
  });

  it.each(["", "not json", "[]", "null"])("answers invalid for an unparseable body %j", async (rawBody) => {
    expect(await make(makeStore()).provider.parseWebhook({ headers: new Headers(), rawBody })).toEqual({ status: "invalid" });
  });

  it("ignores authentic events of other types without calling the API", async () => {
    const { provider, fetchTransaction } = make(makeStore({ existing: record }));
    expect(await provider.parseWebhook(signed({ event: "nequi_token.updated" }))).toMatchObject({ status: "ignored" });
    expect(fetchTransaction).not.toHaveBeenCalled();
  });

  it("ignores an unknown reference", async () => {
    expect(await make(makeStore()).provider.parseWebhook(signed())).toMatchObject({ status: "ignored", reason: "unknown_reference" });
  });

  it("rejects an event whose environment differs from the configured keys", async () => {
    expect(await make(makeStore({ existing: record })).provider.parseWebhook(signed({ environment: "prod" }))).toEqual({
      status: "rejected",
      reason: "environment_mismatch",
    });
  });

  it("ignores PENDING transactions", async () => {
    const { provider } = make(makeStore({ existing: record }), { ok: true, transaction: { ...apiTx, status: "PENDING" } });
    expect(await provider.parseWebhook(signed({ tx: { status: "PENDING" } }))).toMatchObject({ status: "ignored", reason: "pending" });
  });
});
