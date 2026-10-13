import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { CheckoutStatus } from "../checkout-types";
import type { WompiEnvironment } from "./config";

/** The signature must cover these, otherwise the amount or status would travel unsigned. */
const REQUIRED_PROPERTIES: readonly string[] = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];

function constantTimeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a.toLowerCase(), "utf8");
  const y = Buffer.from(b.toLowerCase(), "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

function resolvePath(root: unknown, path: string): string | null {
  let current: unknown = root;
  for (const part of path.split(".")) {
    if (typeof current !== "object" || current === null || !Object.hasOwn(current, part)) return null;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" || typeof current === "number" || typeof current === "boolean" ? String(current) : null;
}

/**
 * Verifies a Wompi event: SHA-256 hex of the values of `signature.properties` (resolved inside `data`,
 * in order) + `timestamp` + events secret, compared in constant time. The property list is read from
 * each event, never hardcoded. When the `X-Event-Checksum` header is present it must agree as well.
 */
export function verifyEventChecksum(input: {
  event: unknown;
  eventsSecret: string;
  headerChecksum?: string | null;
  /** Properties the signature must cover. Defaults to the ones we rely on for transactions. */
  requiredProperties?: readonly string[];
}): boolean {
  const { event, eventsSecret, headerChecksum, requiredProperties = REQUIRED_PROPERTIES } = input;
  if (!eventsSecret || typeof event !== "object" || event === null) return false;
  const { data, signature, timestamp } = event as { data?: unknown; signature?: unknown; timestamp?: unknown };
  if (typeof signature !== "object" || signature === null || typeof data !== "object" || data === null) return false;
  const { properties, checksum } = signature as { properties?: unknown; checksum?: unknown };
  if (!Array.isArray(properties) || properties.length === 0 || typeof checksum !== "string" || checksum === "") return false;
  if (typeof timestamp !== "number" && typeof timestamp !== "string") return false;
  if (!properties.every((p) => typeof p === "string")) return false;
  if (!requiredProperties.every((p) => properties.includes(p))) return false;

  let payload = "";
  for (const property of properties as string[]) {
    const value = resolvePath(data, property);
    if (value === null) return false;
    payload += value;
  }
  const expected = createHash("sha256").update(`${payload}${timestamp}${eventsSecret}`).digest("hex");

  if (!constantTimeEqualHex(expected, checksum)) return false;
  if (headerChecksum && !constantTimeEqualHex(expected, headerChecksum)) return false;
  return true;
}

const EventSchema = z.object({
  event: z.string(),
  environment: z.enum(["test", "prod"]),
  data: z.object({
    transaction: z.object({
      id: z.string().min(1),
      reference: z.string().min(1),
      amount_in_cents: z.number().int(),
      currency: z.string().min(1),
      status: z.string().min(1),
    }),
  }),
});

export type WompiTransaction = {
  id: string;
  reference: string;
  amountInCents: number;
  currency: string;
  status: string;
};

export type WompiEvent = {
  event: string;
  environment: WompiEnvironment;
  transaction: WompiTransaction;
};

/** Extracts the typed subset of a (checksum-verified) transaction event. */
export function parseWompiEvent(raw: unknown): { ok: true; value: WompiEvent } | { ok: false } {
  const parsed = EventSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  const { event, environment, data } = parsed.data;
  const tx = data.transaction;
  return {
    ok: true,
    value: {
      event,
      environment,
      transaction: { id: tx.id, reference: tx.reference, amountInCents: tx.amount_in_cents, currency: tx.currency, status: tx.status },
    },
  };
}

/** Unknown statuses are pending on purpose: only an explicit APPROVED may ever grant access. */
export function mapWompiStatus(status: string): Exclude<CheckoutStatus, "approved_unfulfilled"> {
  switch (status) {
    case "APPROVED":
      return "approved";
    case "DECLINED":
      return "declined";
    case "VOIDED":
      return "voided";
    case "ERROR":
      return "error";
    default:
      return "pending";
  }
}
