import { SellerShell } from "@/components/seller/SellerShell";
import { requireSeller } from "@/lib/auth/guards";

// The (panel) group keeps /vendedor/ingresar outside this guard, so the sign-in screen cannot redirect to itself.
export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const { seller } = await requireSeller();
  return <SellerShell seller={seller}>{children}</SellerShell>;
}
