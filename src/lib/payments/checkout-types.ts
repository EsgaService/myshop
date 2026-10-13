import type { PaymentKind } from "./types";

/**
 * Server-side record of a hosted checkout. Gateways such as Wompi only send back our `reference`,
 * so everything we trust (who pays, what for, how much) is read from this record, never from the event.
 */
export type CheckoutStatus = "pending" | "approved" | "approved_unfulfilled" | "declined" | "voided" | "error";

export type CheckoutRecord = {
  reference: string;
  kind: PaymentKind;
  /** bookId for purchases, sellerId for subscriptions. */
  subjectId: string;
  userId: string;
  amountCents: number;
  currency: string;
  provider: string;
  status: CheckoutStatus;
  providerTransactionId: string | null;
  /** ISO. When the hosted checkout link stops being valid. */
  expiresAt: string | null;
};

export type NewCheckout = Omit<CheckoutRecord, "status" | "providerTransactionId" | "expiresAt"> & { expiresAt: string };

export type CheckoutOutcome = {
  status: CheckoutStatus;
  providerTransactionId: string;
};

export interface CheckoutStore {
  create(checkout: NewCheckout): Promise<void>;
  findByReference(reference: string): Promise<CheckoutRecord | null>;
  /** Idempotent. Only the transitions allowed by `allowedPreviousStatuses` are applied. */
  recordOutcome(reference: string, outcome: CheckoutOutcome): Promise<void>;
  /** Latest still-pending checkout of the same user+subject+amount that expires after `validUntil`, if any. */
  findReusablePending(query: {
    userId: string;
    kind: PaymentKind;
    subjectId: string;
    amountCents: number;
    currency: string;
    provider: string;
    validUntil: Date;
  }): Promise<CheckoutRecord | null>;
  /** The user's own checkout already tied to this gateway transaction (recorded by a webhook or an earlier visit). */
  findByUserAndTransaction(userId: string, transactionId: string): Promise<CheckoutRecord | null>;
  /** Whether the user ever started a checkout (cheap guard before calling the gateway API). */
  userHasCheckouts(userId: string): Promise<boolean>;
}
