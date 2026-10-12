"use server";

import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/auth/guards";
import { decideSlugChange, SLUG_LOCKED_MESSAGE } from "@/lib/seller/decide-slug-change";
import { countPublishedBooks } from "@/lib/seller/published-count";
import { parseSellerProfile, SELLER_SLUG_TAKEN_MESSAGE } from "@/lib/seller/profile-schema";
import { createAdminClient } from "@/lib/supabase/admin";

export type SellerProfileFormState = {
  status: "idle" | "saved" | "error";
  errors?: Record<string, string>;
  message?: string;
};

/**
 * Updates the caller's own seller row. The seller id comes from the session
 * (requireSeller), never from the form, and only validated profile fields are written.
 */
export async function updateSellerProfile(_prev: SellerProfileFormState, formData: FormData): Promise<SellerProfileFormState> {
  const { seller } = await requireSeller();
  const parsed = parseSellerProfile(Object.fromEntries(formData.entries()));
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  // The slug is part of every shared book URL: frozen while any book is published.
  const slugDecision = decideSlugChange({
    currentSlug: seller.slug,
    newSlug: parsed.value.slug,
    publishedBookCount: parsed.value.slug === seller.slug ? 0 : await countPublishedBooks(seller.id),
  });
  if (!slugDecision.ok) return { status: "error", errors: { slug: SLUG_LOCKED_MESSAGE } };

  const { error } = await createAdminClient().from("sellers").update(parsed.value).eq("id", seller.id);
  if (error) {
    if (error.code === "23505") return { status: "error", errors: { slug: SELLER_SLUG_TAKEN_MESSAGE } };
    // The DB check also rejects reserved slugs; surface it like a taken slug.
    if (error.code === "23514") return { status: "error", errors: { slug: SELLER_SLUG_TAKEN_MESSAGE } };
    console.error("seller profile update failed", error);
    return { status: "error", message: "No pudimos guardar tu perfil. Inténtalo de nuevo." };
  }

  revalidatePath("/vendedor", "layout");
  return { status: "saved" };
}
