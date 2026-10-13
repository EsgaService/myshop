import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { requireSeller } from "@/lib/auth/guards";
import { formatPrice } from "@/lib/format";
import { tryGetPaymentProvider } from "@/lib/payments";
import { getSellerSubscription } from "@/lib/seller/access";
import { SELLER_PLAN } from "@/lib/seller/decide-subscription";
import { SubscribeForm } from "./SubscribeForm";

export const metadata = { title: "Suscripción" };

const dateFormat = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" });

export default async function SubscriptionPage() {
  const { seller } = await requireSeller();
  const subscription = seller.is_platform ? null : await getSellerSubscription(seller.id);
  const provider = tryGetPaymentProvider();
  const price = `${formatPrice(SELLER_PLAN.amountCents, SELLER_PLAN.currency)} al mes`;
  const active = subscription?.status === "active";

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Suscripción</h1>
      <p className="mt-2 max-w-xl text-fg-muted">
        Con la suscripción activa tus recetarios publicados aparecen en el catálogo y puedes vender con tu enlace. Preparar tu tienda y subir PDF es gratis.
      </p>

      {seller.is_platform ? (
        <Card className="mt-6 p-6">
          <p className="text-fg-muted">Tu cuenta es de la plataforma y no necesita suscripción.</p>
        </Card>
      ) : (
        <Card className="mt-6 max-w-xl space-y-5 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-xl font-semibold">Plan vendedor</h2>
            <Badge tone={active ? "success" : "warning"}>{active ? "Activa" : subscription?.status === "lapsed" ? "Vencida" : "Sin activar"}</Badge>
          </div>
          <p className="font-mono text-2xl font-medium">{price}</p>

          {active && subscription?.activeUntil && (
            <p className="text-sm text-fg-muted">
              Tu suscripción cubre hasta el {dateFormat.format(subscription.activeUntil)}. Si pagas ahora, el nuevo mes empieza justo cuando termina el actual.
            </p>
          )}
          {subscription?.status === "lapsed" && (
            <Notice>
              Tu suscripción venció: tus recetarios no aparecen en el catálogo ni se pueden comprar. Quienes ya los compraron conservan su acceso.
              Al renovar, vuelven a estar disponibles.
            </Notice>
          )}
          {subscription?.status === "none" && (
            <p className="text-sm text-fg-muted">Aún no tienes una suscripción. Actívala para poder publicar tus recetarios.</p>
          )}

          {provider ? (
            <>
              <SubscribeForm label={active ? "Pagar el siguiente mes" : "Activar suscripción"} />
              {provider.id === "wompi" && (
                <p className="text-xs text-fg-muted">Pagas en Wompi (tarjeta, PSE, Nequi u otros medios) y te traemos de vuelta aquí al terminar.</p>
              )}
              {provider.id === "mock" && (
                <p className="text-xs text-fg-muted">Entorno de pruebas: el pago se simula y no se cobra dinero real.</p>
              )}
            </>
          ) : (
            <p role="status" className="text-sm text-fg-muted">Los pagos aún no están habilitados en este entorno.</p>
          )}
        </Card>
      )}
    </div>
  );
}
