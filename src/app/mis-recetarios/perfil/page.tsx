import { requireBuyer } from "@/lib/auth/guards";
import { ProfileForm } from "./ProfileForm";

export const metadata = { title: "Mi perfil" };

export default async function BuyerProfilePage() {
  const { user, profile } = await requireBuyer();
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Mi perfil</h1>
      <ProfileForm
        email={user.email ?? ""}
        initial={{ displayName: profile.display_name ?? "", phone: profile.phone ?? "", city: profile.city ?? "" }}
      />
    </div>
  );
}
