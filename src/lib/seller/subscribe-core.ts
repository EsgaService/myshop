import { PaymentsDisabledError, type PaymentProvider } from "@/lib/payments/types";
import type { GrantSubscriptionInput } from "@/lib/payments/fulfill-rows";
import { SELLER_PLAN } from "./decide-subscription";

export type SubscribeResult = { ok: true; redirectTo?: string } | { ok: false; message: string };

/**
 * Starts a plan payment. The amount and currency come ONLY from SELLER_PLAN:
 * there is deliberately no amount parameter, so a client cannot change the charge (R6).
 * A synchronous `paid` result is fulfilled here; hosted checkouts are fulfilled by the verified webhook.
 */
export async function runSubscribe(input: {
  provider: PaymentProvider | null;
  userId: string;
  sellerId: string;
  email?: string;
  siteUrl?: string;
  grant(input: GrantSubscriptionInput): Promise<void>;
}): Promise<SubscribeResult> {
  if (!input.provider) {
    return { ok: false, message: "Los pagos no están habilitados en este entorno." };
  }

  try {
    const result = await input.provider.createCheckout({
      kind: "subscription",
      userId: input.userId,
      subjectId: input.sellerId,
      amountCents: SELLER_PLAN.amountCents,
      currency: SELLER_PLAN.currency,
      payer: { email: input.email },
      returnUrl: `${input.siteUrl ?? ""}/vendedor/suscripcion`,
    });

    if (result.status === "redirect") return { ok: true, redirectTo: result.url };

    await input.grant({ sellerId: input.sellerId, provider: input.provider.id, providerRef: result.providerRef });
    return { ok: true };
  } catch (error) {
    if (error instanceof PaymentsDisabledError) {
      return { ok: false, message: "Los pagos no están habilitados en este entorno." };
    }
    console.error("subscription checkout failed", error);
    return { ok: false, message: "No pudimos procesar el pago. Inténtalo de nuevo." };
  }
}
