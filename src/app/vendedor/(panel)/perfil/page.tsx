import { requireSeller } from "@/lib/auth/guards";
import { countPublishedBooks } from "@/lib/seller/published-count";
import { SellerProfileForm } from "./SellerProfileForm";

export const metadata = { title: "Perfil de la tienda" };

export default async function SellerProfilePage() {
  const { user, seller } = await requireSeller();
  const slugLocked = (await countPublishedBooks(seller.id)) > 0;
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Perfil de la tienda</h1>
      <p className="mt-2 text-fg-muted">El nombre de tu tienda se muestra en tu panel y en tu página pública.</p>
      <SellerProfileForm
        email={user.email ?? ""}
        slugLocked={slugLocked}
        initial={{
          storeName: seller.store_name,
          slug: seller.slug,
          bio: seller.bio ?? "",
          city: seller.city ?? "",
          instagram: seller.instagram ?? "",
          whatsapp: seller.whatsapp ?? "",
        }}
      />
    </div>
  );
}
