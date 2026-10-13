import { createHash } from "node:crypto";

export const WOMPI_CHECKOUT_URL = "https://checkout.wompi.co/p/";

/** Wompi accepts alphanumerics plus "-" and "_" in references. */
export const REFERENCE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Integrity signature of a Web Checkout: SHA-256 hex of
 * `<reference><amountInCents><currency>[<expirationTime>]<integritySecret>`.
 * Computed server-side only; the secret never reaches the browser.
 */
export function integritySignature(input: {
  reference: string;
  amountInCents: number;
  currency: string;
  expirationTime?: string;
  integritySecret: string;
}): string {
  const payload = `${input.reference}${input.amountInCents}${input.currency}${input.expirationTime ?? ""}${input.integritySecret}`;
  return createHash("sha256").update(payload).digest("hex");
}

export type CheckoutUrlInput = {
  publicKey: string;
  integritySecret: string;
  reference: string;
  amountInCents: number;
  currency: string;
  redirectUrl?: string;
  /** ISO 8601 UTC. When set it is part of the signature. */
  expirationTime?: string;
  customerEmail?: string;
  customerName?: string;
};

/** Builds the hosted Web Checkout URL the browser is sent to. */
export function buildCheckoutUrl(input: CheckoutUrlInput): string {
  if (!REFERENCE_PATTERN.test(input.reference)) throw new Error("Invalid Wompi reference");
  if (!Number.isInteger(input.amountInCents) || input.amountInCents <= 0) throw new Error("Invalid Wompi amount");

  const url = new URL(WOMPI_CHECKOUT_URL);
  url.searchParams.set("public-key", input.publicKey);
  url.searchParams.set("currency", input.currency);
  url.searchParams.set("amount-in-cents", String(input.amountInCents));
  url.searchParams.set("reference", input.reference);
  url.searchParams.set(
    "signature:integrity",
    integritySignature({
      reference: input.reference,
      amountInCents: input.amountInCents,
      currency: input.currency,
      expirationTime: input.expirationTime || undefined,
      integritySecret: input.integritySecret,
    }),
  );
  if (input.redirectUrl) url.searchParams.set("redirect-url", input.redirectUrl);
  if (input.expirationTime) url.searchParams.set("expiration-time", input.expirationTime);
  if (input.customerEmail) url.searchParams.set("customer-data:email", input.customerEmail);
  if (input.customerName) url.searchParams.set("customer-data:full-name", input.customerName);
  return url.toString();
}
