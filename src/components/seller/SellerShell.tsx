import type { ReactNode } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { SignOutButton } from "@/components/ui/SignOutButton";
import type { Seller } from "@/lib/data/types";
import { sellerNav } from "@/lib/seller/nav";

/** Seller chrome: the store name tops the bar, the sidebar only links to the seller area. */
export function SellerShell({ seller, children }: { seller: Seller; children: ReactNode }) {
  return (
    <AppShell title={seller.store_name} nav={sellerNav()} actions={<SignOutButton />}>
      {children}
    </AppShell>
  );
}
