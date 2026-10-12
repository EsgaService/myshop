import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/recipes/normalize-book";
import { toSellerSlug } from "@/lib/seller/slug";
import { ensureAccountCore, type AccountDeps, type EnsureAccountInput } from "./ensure-account-core";
import type { RoleDecision } from "./decide-role";

function adminDeps(): AccountDeps {
  const admin = createAdminClient();
  return {
    async getProfileRole(userId) {
      const { data, error } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
      if (error) throw new Error(`profile lookup failed: ${error.message}`);
      return (data?.role as "buyer" | "seller" | undefined) ?? null;
    },
    async hasLegacyPurchases(userId) {
      const { count, error } = await admin.from("purchases").select("id", { count: "exact", head: true }).eq("user_id", userId);
      if (error) throw new Error(`purchase lookup failed: ${error.message}`);
      return (count ?? 0) > 0;
    },
    async insertProfile(row) {
      const { error } = await admin.from("profiles").upsert(row, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw new Error(`profile insert failed: ${error.message}`);
    },
    async hasSellerRow(userId) {
      const { data, error } = await admin.from("sellers").select("id").eq("user_id", userId).maybeSingle();
      if (error) throw new Error(`seller lookup failed: ${error.message}`);
      return Boolean(data);
    },
    async insertSeller({ userId, storeName, avatarUrl }) {
      // Retry once if a concurrent signup grabbed the same slug between lookup and insert.
      for (let attempt = 0; attempt < 2; attempt++) {
        const base = slugify(storeName).slice(0, 40);
        const { data } = await admin.from("sellers").select("slug").ilike("slug", `${base}%`);
        const slug = toSellerSlug(storeName, (data ?? []).map((r) => r.slug as string));
        const { error } = await admin
          .from("sellers")
          .insert({ user_id: userId, slug, store_name: storeName, avatar_url: avatarUrl });
        if (!error) return;
        if (error.code === "23505" && (await this.hasSellerRow(userId))) return; // same user raced
        if (error.code !== "23505" || attempt === 1) throw new Error(`seller insert failed: ${error.message}`);
      }
    },
    async mirrorRole(userId, role) {
      const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata: { role } });
      if (error) throw new Error(error.message);
    },
  };
}

export function ensureAccount(input: EnsureAccountInput): Promise<RoleDecision> {
  return ensureAccountCore(adminDeps(), input);
}
