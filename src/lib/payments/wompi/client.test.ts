import { describe, expect, it, vi } from "vitest";
import { parseWompiConfig } from "./config";
import { fetchWompiTransaction } from "./client";

const parsed = parseWompiConfig({
  WOMPI_PUBLIC_KEY: "pub_test_a",
  WOMPI_PRIVATE_KEY: "prv_test_b",
  WOMPI_EVENTS_SECRET: "test_events_c",
  WOMPI_INTEGRITY_SECRET: "test_integrity_d",
});
if (!parsed.ok) throw new Error("fixture");
const config = parsed.config;

const apiTx = { id: "tx-1", reference: "mys-p-abc", amount_in_cents: 500000, currency: "COP", status: "APPROVED", extra: "ignored" };

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));
}

describe("fetchWompiTransaction", () => {
  it("calls GET /transactions/{id} on the configured base with the private key", async () => {
    const f = fakeFetch(200, { data: apiTx });
    const r = await fetchWompiTransaction({ config, id: "tx-1", fetchImpl: f });
    expect(f).toHaveBeenCalledTimes(1);
    expect(String(f.mock.calls[0][0])).toBe("https://sandbox.wompi.co/v1/transactions/tx-1");
    expect(new Headers(f.mock.calls[0][1]?.headers).get("authorization")).toBe("Bearer prv_test_b");
    expect(r).toEqual({
      ok: true,
      transaction: { id: "tx-1", reference: "mys-p-abc", amountInCents: 500000, currency: "COP", status: "APPROVED" },
    });
  });

  it("reports not_found on 404", async () => {
    expect(await fetchWompiTransaction({ config, id: "tx-1", fetchImpl: fakeFetch(404, { error: {} }) })).toEqual({ ok: false, reason: "not_found" });
  });

  it("reports unavailable on other HTTP errors, network failures and malformed bodies", async () => {
    expect(await fetchWompiTransaction({ config, id: "tx-1", fetchImpl: fakeFetch(500, {}) })).toEqual({ ok: false, reason: "unavailable" });
    expect(await fetchWompiTransaction({ config, id: "tx-1", fetchImpl: fakeFetch(200, { data: { nope: 1 } }) })).toEqual({ ok: false, reason: "unavailable" });
    const boom = vi.fn(async () => {
      throw new Error("network");
    });
    expect(await fetchWompiTransaction({ config, id: "tx-1", fetchImpl: boom })).toEqual({ ok: false, reason: "unavailable" });
  });

  it.each(["", "../x", "a/b", "a?b=1", "a b"])("never calls the API with an unsafe id %j", async (id) => {
    const f = fakeFetch(200, { data: apiTx });
    expect(await fetchWompiTransaction({ config, id, fetchImpl: f })).toEqual({ ok: false, reason: "not_found" });
    expect(f).not.toHaveBeenCalled();
  });
});
