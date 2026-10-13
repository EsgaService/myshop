"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSeller } from "@/lib/auth/guards";
import { tryGetPaymentProvider } from "@/lib/payments";
import { grantSubscriptionPeriod } from "@/lib/payments/fulfill";
import { originFromHeaders, resolveSiteOrigin } from "@/lib/payments/site-origin";
import { runSubscribe } from "@/lib/seller/subscribe-core";

export type SubscribeState = { status: "idle" | "saved" | "error"; message?: string };

/**
 * Pays one plan period. The form carries no data on purpose: seller identity comes
 * from the session and the amount from SELLER_PLAN, so nothing here is client-controlled.
 */
export async function subscribe(_prev: SubscribeState): Promise<SubscribeState> {
  const { user, seller } = await requireSeller();
  if (seller.is_platform) return { status: "error", message: "La cuenta de la plataforma no necesita suscripción." };

  // Configured site URL; outside production the request origin is an acceptable fallback.
  const siteUrl = resolveSiteOrigin({
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    requestOrigin: originFromHeaders(await headers()),
    nodeEnv: process.env.NODE_ENV,
  });

  const result = await runSubscribe({
    provider: tryGetPaymentProvider(),
    userId: user.id,
    sellerId: seller.id,
    email: user.email ?? undefined,
    siteUrl: siteUrl ?? undefined,
    grant: grantSubscriptionPeriod,
  });

  if (!result.ok) return { status: "error", message: result.message };
  if (result.redirectTo) redirect(result.redirectTo);

  revalidatePath("/vendedor", "layout");
  return { status: "saved" };
}
