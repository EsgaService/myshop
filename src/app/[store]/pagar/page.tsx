import { notFound, redirect } from "next/navigation";
import { decideAccess } from "@/lib/access/decide-access";
import { getCurrentUser, getStore, hasPurchased } from "@/lib/data/queries";
import { formatPrice } from "@/lib/format";
import { PayForm } from "./PayForm";

export default async function CheckoutPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const store = await getStore(slug);
  if (!store) notFound();

  const user = await getCurrentUser();
  const decision = decideAccess({
    slug,
    route: "checkout",
    isAuthenticated: !!user,
    hasPurchase: user ? await hasPurchased(store.id) : false,
  });
  if (decision.kind === "redirect") redirect(decision.to);

  const mockEnabled = process.env.PAYMENTS_MODE === "mock";

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold">{store.name}</h1>
      <p className="mt-1 text-3xl font-extrabold" style={{ color: "var(--brand-primary)" }}>
        {formatPrice(store.price_cents, store.currency)}
      </p>
      <p className="mt-2 text-sm opacity-70">Compra con la cuenta {user?.email}.</p>

      {mockEnabled ? (
        <PayForm slug={store.slug} />
      ) : (
        <p className="mt-8 rounded-xl border border-black/10 p-4">Los pagos aún no están habilitados. Vuelve pronto.</p>
      )}
    </main>
  );
}
