import "server-only";
import { redirect } from "next/navigation";
import { decideArea, type Area } from "./decide-area";
import { getMySeller, getProfile } from "@/lib/data/queries";
import type { Profile, Seller } from "@/lib/data/types";
import { createClient } from "@/lib/supabase/server";

type AuthUser = NonNullable<Awaited<ReturnType<typeof getAuthUser>>>;

async function getAuthUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** The role comes from `profiles` (never the JWT or user_metadata) so it cannot be forged or stale. */
async function requireArea(area: Area): Promise<{ user: AuthUser; profile: Profile }> {
  const user = await getAuthUser();
  const profile = user ? await getProfile() : null;
  const decision = decideArea({ role: profile?.role ?? null, area });
  if (decision.kind === "redirect" || !user || !profile) {
    redirect(decision.kind === "redirect" ? decision.to : area === "seller" ? "/vendedor/ingresar" : "/ingresar");
  }
  return { user, profile };
}

export async function requireBuyer(): Promise<{ user: AuthUser; profile: Profile }> {
  return requireArea("buyer");
}

export async function requireSeller(): Promise<{ user: AuthUser; profile: Profile; seller: Seller }> {
  const { user, profile } = await requireArea("seller");
  const seller = await getMySeller();
  if (!seller) redirect("/vendedor/ingresar");
  return { user, profile, seller };
}
