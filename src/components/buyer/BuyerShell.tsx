import type { ReactNode } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { SignOutButton } from "@/components/ui/SignOutButton";
import { buyerNav } from "@/lib/buyer/nav";
import { listOwnedBooks } from "@/lib/data/queries";
import type { Profile } from "@/lib/data/types";

/** Buyer chrome: sidebar with owned books, profile and the marketplace CTA at the bottom (R16). */
export async function BuyerShell({ profile, email, children }: { profile: Profile; email?: string | null; children: ReactNode }) {
  const owned = await listOwnedBooks();
  const { nav, footerLink } = buyerNav(owned);
  return (
    <AppShell title={profile.display_name ?? email ?? "Mi cuenta"} nav={nav} footerLink={footerLink} actions={<SignOutButton />}>
      {children}
    </AppShell>
  );
}
