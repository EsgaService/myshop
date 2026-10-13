import { randomUUID } from "node:crypto";
import type { CheckoutStore } from "../checkout-types";
import { isReusableCheckout, REUSE_MIN_REMAINING_MS } from "../checkout-status";
import { paymentResultPath } from "../return-routes";
import { PaymentsDisabledError, type CheckoutInput, type CheckoutResult, type PaymentKind, type PaymentProvider, type WebhookOutcome } from "../types";
import { fetchWompiTransaction, type FetchTransactionResult } from "./client";
import type { WompiConfig } from "./config";
import { decideWompiTransaction } from "./decide-transaction";
import { parseWompiEvent, verifyEventChecksum } from "./events";
import { buildCheckoutUrl } from "./signature";

/** A checkout link is only valid for this long (it is part of the signature). */
const CHECKOUT_TTL_MS = 60 * 60 * 1000;

/** Absolute URL of the page Wompi sends the payer back to, on the same origin as the app's own return URL. */
function resultUrlFrom(kind: PaymentKind, returnUrl: string | undefined): string | undefined {
  if (!returnUrl) return undefined;
  try {
    return new URL(paymentResultPath(kind), returnUrl).toString();
  } catch {
    return undefined;
  }
}

/**
 * Wompi Web Checkout adapter. The platform's single Wompi account receives every payment.
 * `createCheckout` stores our own record first (Wompi events only carry the `reference`), then returns
 * the hosted-checkout URL. Fulfillment never happens here: it follows a verified webhook or a
 * server-to-server reconciliation of the return page.
 */
export class WompiPaymentProvider implements PaymentProvider {
  readonly id = "wompi";
  private readonly config: WompiConfig;
  private readonly store: CheckoutStore;
  private readonly now: () => Date;
  private readonly randomId: () => string;
  private readonly fetchTransaction: (id: string) => Promise<FetchTransactionResult>;

  constructor(options: {
    config: WompiConfig;
    store: CheckoutStore;
    now?: () => Date;
    randomId?: () => string;
    fetchTransaction?: (id: string) => Promise<FetchTransactionResult>;
  }) {
    this.config = options.config;
    this.store = options.store;
    this.now = options.now ?? (() => new Date());
    this.randomId = options.randomId ?? randomUUID;
    this.fetchTransaction = options.fetchTransaction ?? ((id) => fetchWompiTransaction({ config: options.config, id }));
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const redirectUrl = resultUrlFrom(input.kind, input.returnUrl);
    if (!redirectUrl) {
      // Wompi needs an absolute redirect-url to bring the payer back; silently omitting it would strand them.
      throw new PaymentsDisabledError("Wompi checkout needs an absolute return URL: set NEXT_PUBLIC_SITE_URL");
    }
    const now = this.now();

    // Double click / second tab: hand out the checkout that is still valid instead of creating another charge target.
    const reusable = await this.store.findReusablePending({
      userId: input.userId,
      kind: input.kind,
      subjectId: input.subjectId,
      amountCents: input.amountCents,
      currency: input.currency,
      provider: this.id,
      validUntil: new Date(now.getTime() + REUSE_MIN_REMAINING_MS),
    });
    if (reusable && reusable.expiresAt && isReusableCheckout(reusable, now)) {
      return {
        status: "redirect",
        providerRef: reusable.reference,
        url: this.urlFor(input, reusable.reference, reusable.expiresAt, redirectUrl),
      };
    }

    const reference = `mys-${input.kind === "purchase" ? "p" : "s"}-${this.randomId().replace(/-/g, "")}`;
    const expirationTime = new Date(now.getTime() + CHECKOUT_TTL_MS).toISOString();

    // Build first so an invalid amount fails before anything is stored.
    const url = this.urlFor(input, reference, expirationTime, redirectUrl);

    await this.store.create({
      reference,
      kind: input.kind,
      subjectId: input.subjectId,
      userId: input.userId,
      amountCents: input.amountCents,
      currency: input.currency,
      provider: this.id,
      expiresAt: expirationTime,
    });

    return { status: "redirect", providerRef: reference, url };
  }

  private urlFor(input: CheckoutInput, reference: string, expirationTime: string, redirectUrl: string): string {
    return buildCheckoutUrl({
      publicKey: this.config.publicKey,
      integritySecret: this.config.integritySecret,
      reference,
      amountInCents: input.amountCents,
      currency: input.currency,
      redirectUrl,
      expirationTime,
      customerEmail: input.payer.email,
      customerName: input.payer.name,
    });
  }

  async parseWebhook(request: { headers: Headers; rawBody: string }): Promise<WebhookOutcome> {
    let raw: unknown;
    try {
      raw = JSON.parse(request.rawBody);
    } catch {
      return { status: "invalid" };
    }
    if (typeof raw !== "object" || raw === null) return { status: "invalid" };

    const headerChecksum = request.headers.get("x-event-checksum");
    const isTransaction = (raw as { event?: unknown }).event === "transaction.updated";
    const authentic = verifyEventChecksum({
      event: raw,
      eventsSecret: this.config.eventsSecret,
      headerChecksum,
      // Other event types are only acknowledged, so their signature is not required to cover transaction fields.
      requiredProperties: isTransaction ? undefined : [],
    });
    if (!authentic) return { status: "invalid" };
    if (!isTransaction) return { status: "ignored", reason: "unhandled_event" };

    const parsed = parseWompiEvent(raw);
    if (!parsed.ok) return { status: "invalid" };
    const { transaction: claimed, environment } = parsed.value;

    // Defense in depth: after the checksum, trust Wompi's API (private key) over the body of the request.
    const fetched = await this.fetchTransaction(claimed.id);
    if (!fetched.ok) {
      // Unavailable: fail so Wompi retries later. Unknown: nothing to fulfil.
      if (fetched.reason === "unavailable") throw new Error("Wompi transaction lookup unavailable");
      return { status: "rejected", reason: "transaction_not_found" };
    }
    const transaction = fetched.transaction;
    if (transaction.reference !== claimed.reference) return { status: "rejected", reason: "reference_mismatch" };

    const checkout = await this.store.findByReference(transaction.reference);
    const decision = decideWompiTransaction({
      transaction,
      checkout,
      configEnvironment: this.config.environment,
      eventEnvironment: environment,
    });
    if (decision.kind === "event") return { status: "event", event: decision.event };
    if (decision.kind === "rejected") return { status: "rejected", reason: decision.reason };
    return { status: "ignored", reason: decision.reason };
  }
}
