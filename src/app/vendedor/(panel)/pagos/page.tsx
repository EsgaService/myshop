import { Card } from "@/components/ui/Card";
import { requireSeller } from "@/lib/auth/guards";
import { getSavedPayoutAccount } from "@/lib/seller/payout-store";
import { PayoutAccountForm } from "./PayoutAccountForm";

export const metadata = { title: "Cuenta para pagos" };

export default async function PayoutAccountPage() {
  const { seller } = await requireSeller();
  const saved = await getSavedPayoutAccount(seller.id);
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Cuenta para pagos</h1>
      <p className="mt-2 max-w-xl text-fg-muted">
        La plataforma recibe los pagos de tus compradores a través de Wompi y luego te transfiere tus ganancias a esta cuenta.
        Revisa bien los datos: el titular debe ser quien aparece en el documento.
      </p>
      <Card className="mt-6 max-w-xl p-6">
        <PayoutAccountForm saved={saved} />
      </Card>
    </div>
  );
}
