import { BuyerShell } from "@/components/buyer/BuyerShell";
import { requireBuyer } from "@/lib/auth/guards";

export default async function BuyerLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireBuyer();
  return (
    <BuyerShell profile={profile} email={user.email}>
      {children}
    </BuyerShell>
  );
}
