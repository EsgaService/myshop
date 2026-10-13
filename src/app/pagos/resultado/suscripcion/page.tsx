import { PaymentResult } from "@/components/payments/PaymentResult";

export const metadata = { title: "Resultado del pago" };
export const dynamic = "force-dynamic";

/** Return page for the seller subscription: a signed-out seller is sent to the seller sign-in. */
export default async function SubscriptionPaymentResultPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return <PaymentResult expectedKind="subscription" id={id} />;
}
