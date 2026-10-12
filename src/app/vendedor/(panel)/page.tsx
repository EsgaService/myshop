import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { requireSeller } from "@/lib/auth/guards";
import { avisoMessage } from "@/lib/auth/screens";
import { MAX_UPLOADS_PER_SELLER } from "@/lib/books/upload-limit";
import { listMyBooks, listMyUploads } from "@/lib/data/queries";
import { getSellerSubscription } from "@/lib/seller/access";
import { storePath } from "@/lib/books/share-links";

export const metadata = { title: "Panel del vendedor" };

const dateFormat = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" });

export default async function SellerDashboardPage({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const [{ seller, profile }, { aviso }] = await Promise.all([requireSeller(), searchParams]);
  const [books, uploads, subscription] = await Promise.all([
    listMyBooks(seller.id),
    listMyUploads(seller.id),
    seller.is_platform ? null : getSellerSubscription(seller.id),
  ]);
  const notice = avisoMessage(aviso, profile.role);
  const published = books.filter((b) => b.status === "published").length;
  const drafts = books.filter((b) => b.status === "draft").length;
  const active = seller.is_platform || subscription?.status === "active";

  return (
    <div>
      {notice && <Notice>{notice}</Notice>}
      <h1 className="font-display text-3xl font-semibold tracking-tight">Hola, {seller.store_name}</h1>
      <p className="mt-2 text-fg-muted">Sube tus PDF, ponles precio y comparte tu tienda: {storePath(seller.slug)}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="font-mono text-xs uppercase tracking-wider text-fg-muted">Publicados</p>
          <p className="mt-2 font-display text-4xl font-semibold">{published}</p>
        </Card>
        <Card className="p-5">
          <p className="font-mono text-xs uppercase tracking-wider text-fg-muted">Borradores</p>
          <p className="mt-2 font-display text-4xl font-semibold">{drafts}</p>
        </Card>
        <Card className="p-5">
          <p className="font-mono text-xs uppercase tracking-wider text-fg-muted">PDF subidos</p>
          <p className="mt-2 font-display text-4xl font-semibold">
            {uploads.length}/{MAX_UPLOADS_PER_SELLER}
          </p>
        </Card>
      </div>

      <Card className="mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-semibold">Suscripción</h2>
            <Badge tone={active ? "success" : "warning"}>{active ? "Activa" : subscription?.status === "lapsed" ? "Vencida" : "Sin activar"}</Badge>
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            {seller.is_platform
              ? "Cuenta de la plataforma: no necesita suscripción."
              : active && subscription?.activeUntil
                ? `Tus recetarios publicados están a la venta hasta el ${dateFormat.format(subscription.activeUntil)}.`
                : "Puedes preparar tu tienda y subir tus PDF, pero necesitas una suscripción activa para publicar."}
          </p>
        </div>
        {!seller.is_platform && (
          <ButtonLink href="/vendedor/suscripcion" variant={active ? "outline" : "primary"}>
            {active ? "Ver suscripción" : "Activar suscripción"}
          </ButtonLink>
        )}
      </Card>

      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/vendedor/productos">Ir a mis productos</ButtonLink>
        <ButtonLink href="/vendedor/perfil" variant="outline">Editar perfil</ButtonLink>
      </div>
    </div>
  );
}
