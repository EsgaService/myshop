import { PaymentResult } from "@/components/payments/PaymentResult";

export const metadata = { title: "Resultado del pago" };
export const dynamic = "force-dynamic";

/** Return page for book purchases (Wompi appends `?id=<transactionId>`). */
export default async function PaymentResultPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return <PaymentResult expectedKind="purchase" id={id} />;
}
