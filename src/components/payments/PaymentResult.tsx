import { redirect } from "next/navigation";
import { AutoRefresh } from "@/components/payments/AutoRefresh";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { bookPaths } from "@/lib/books/share-links";
import { getCurrentUser } from "@/lib/data/queries";
import { decideReturnView } from "@/lib/payments/decide-return-view";
import { signInUrlForPaymentResult } from "@/lib/payments/return-routes";
import type { PaymentKind } from "@/lib/payments/types";
import { resolveWompiReturn } from "@/lib/payments/wompi/resolve-return";
import { createAdminClient } from "@/lib/supabase/admin";

async function bookPathsFor(bookId: string) {
  const { data } = await createAdminClient().from("books").select("slug,seller:sellers!inner(slug)").eq("id", bookId).maybeSingle();
  const seller = data?.seller as { slug: string } | { slug: string }[] | null | undefined;
  const sellerSlug = Array.isArray(seller) ? seller[0]?.slug : seller?.slug;
  return data && sellerSlug ? bookPaths(sellerSlug, data.slug as string) : null;
}

/**
 * Where Wompi sends the payer back (`?id=<transactionId>`). The id is NOT trusted: see reconcileWompiTransaction.
 * `expectedKind` comes from the route (subscriptions have their own path) and only decides which sign-in
 * screen a signed-out payer is sent to; what is shown always comes from our own checkout record.
 */
export async function PaymentResult({ expectedKind, id }: { expectedKind: PaymentKind; id: string | undefined }) {
  const user = await getCurrentUser();
  // The auth callback re-validates `next` (same-origin path allowed for the role): no open redirect.
  if (!user) redirect(signInUrlForPaymentResult({ kind: expectedKind, id }));

  const result = id ? await resolveWompiReturn({ transactionId: id, userId: user.id }) : ({ state: "unknown" } as const);
  const kind = "kind" in result ? result.kind : undefined;
  const view = decideReturnView({ state: result.state, kind });

  let href: string | null = null;
  let linkLabel = "";
  if (view.link === "subscription") {
    href = "/vendedor/suscripcion";
    linkLabel = "Ir a mi suscripción";
  } else if (view.link === "book" && "subjectId" in result) {
    const paths = await bookPathsFor(result.subjectId);
    href = paths ? (result.state === "approved" ? paths.book : paths.landing) : null;
    linkLabel = result.state === "approved" ? "Abrir mi recetario" : "Volver al recetario";
  }

  const toneClass = view.tone === "success" ? "text-success" : view.tone === "danger" ? "text-danger" : "text-fg-muted";

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      {view.autoRefresh && <AutoRefresh />}
      <Card className="space-y-4 p-8 text-center">
        <h1 className={`font-display text-2xl font-semibold ${toneClass}`}>{view.title}</h1>
        <p role="status" className="text-fg-muted">{view.message}</p>
        {href && <ButtonLink href={href}>{linkLabel}</ButtonLink>}
      </Card>
    </main>
  );
}
