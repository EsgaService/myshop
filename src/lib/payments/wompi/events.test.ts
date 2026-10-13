import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mapWompiStatus, parseWompiEvent, verifyEventChecksum } from "./events";

const SECRET = "test_events_secret";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function makeEvent(over: Record<string, unknown> = {}, tx: Record<string, unknown> = {}) {
  const transaction = {
    id: "1234-1610641025-49201",
    amount_in_cents: 500000,
    reference: "mys-p-abc",
    customer_email: "a@b.co",
    currency: "COP",
    payment_method_type: "NEQUI",
    redirect_url: "https://shop.test/pagos/resultado",
    status: "APPROVED",
    ...tx,
  };
  const timestamp = 1530291411;
  const checksum = sha(`${transaction.id}${transaction.status}${transaction.amount_in_cents}${timestamp}${SECRET}`);
  return {
    event: "transaction.updated",
    data: { transaction },
    environment: "test",
    signature: {
      properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
      checksum,
    },
    timestamp,
    sent_at: "2026-10-12T20:00:00.000Z",
    ...over,
  };
}

describe("verifyEventChecksum", () => {
  it("accepts an event whose checksum matches", () => {
    expect(verifyEventChecksum({ event: makeEvent(), eventsSecret: SECRET })).toBe(true);
  });

  it("accepts a matching X-Event-Checksum header (case-insensitive)", () => {
    const e = makeEvent();
    expect(verifyEventChecksum({ event: e, eventsSecret: SECRET, headerChecksum: e.signature.checksum.toUpperCase() })).toBe(true);
  });

  it("rejects when the header disagrees with the body", () => {
    expect(verifyEventChecksum({ event: makeEvent(), eventsSecret: SECRET, headerChecksum: sha("x") })).toBe(false);
  });

  it("rejects the wrong secret", () => {
    expect(verifyEventChecksum({ event: makeEvent(), eventsSecret: "test_events_other" })).toBe(false);
  });

  it("rejects a tampered amount", () => {
    const e = makeEvent();
    (e.data.transaction as { amount_in_cents: number }).amount_in_cents = 1;
    expect(verifyEventChecksum({ event: e, eventsSecret: SECRET })).toBe(false);
  });

  it("rejects a tampered status", () => {
    const e = makeEvent();
    (e.data.transaction as { status: string }).status = "DECLINED";
    expect(verifyEventChecksum({ event: e, eventsSecret: SECRET })).toBe(false);
  });

  it("rejects a tampered timestamp", () => {
    expect(verifyEventChecksum({ event: makeEvent({ timestamp: 1 }), eventsSecret: SECRET })).toBe(false);
  });

  it("reads the property list from the event, not a hardcoded one", () => {
    const e = makeEvent();
    e.signature.properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents", "transaction.reference"];
    e.signature.checksum = sha(`1234-1610641025-49201APPROVED500000mys-p-abc1530291411${SECRET}`);
    expect(verifyEventChecksum({ event: e, eventsSecret: SECRET })).toBe(true);
  });

  it("requires the signature to cover id, status and amount (an unsigned amount is useless)", () => {
    const e = makeEvent();
    e.signature.properties = ["transaction.id", "transaction.status"];
    e.signature.checksum = sha(`1234-1610641025-49201APPROVED1530291411${SECRET}`);
    expect(verifyEventChecksum({ event: e, eventsSecret: SECRET })).toBe(false);
  });

  it("rejects a property that resolves to nothing", () => {
    const e = makeEvent();
    e.signature.properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents", "transaction.nope"];
    expect(verifyEventChecksum({ event: e, eventsSecret: SECRET })).toBe(false);
  });

  it.each([null, undefined, 5, "x", [], {}, { signature: null }, { data: {}, signature: { properties: "x", checksum: "y" } }])(
    "rejects malformed input %j without throwing",
    (event) => {
      expect(verifyEventChecksum({ event, eventsSecret: SECRET })).toBe(false);
    },
  );

  it("rejects when no secret is configured", () => {
    expect(verifyEventChecksum({ event: makeEvent(), eventsSecret: "" })).toBe(false);
  });
});

describe("parseWompiEvent", () => {
  it("extracts the transaction fields we use", () => {
    expect(parseWompiEvent(makeEvent())).toEqual({
      ok: true,
      value: {
        event: "transaction.updated",
        environment: "test",
        transaction: { id: "1234-1610641025-49201", reference: "mys-p-abc", amountInCents: 500000, currency: "COP", status: "APPROVED" },
      },
    });
  });

  it("fails on a malformed transaction or environment", () => {
    expect(parseWompiEvent(makeEvent({}, { amount_in_cents: "5" })).ok).toBe(false);
    expect(parseWompiEvent(makeEvent({ environment: "staging" })).ok).toBe(false);
    expect(parseWompiEvent({}).ok).toBe(false);
  });
});

describe("mapWompiStatus", () => {
  it.each([
    ["APPROVED", "approved"],
    ["DECLINED", "declined"],
    ["VOIDED", "voided"],
    ["ERROR", "error"],
    ["PENDING", "pending"],
  ])("maps %s to %s", (input, out) => {
    expect(mapWompiStatus(input)).toBe(out);
  });

  it("treats unknown statuses as pending (never as paid)", () => {
    expect(mapWompiStatus("SOMETHING_NEW")).toBe("pending");
  });
});
