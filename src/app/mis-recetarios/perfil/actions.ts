"use server";

import { revalidatePath } from "next/cache";
import { parseBuyerProfile } from "@/lib/account/profile-schema";
import { requireBuyer } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProfileFormState = { status: "idle" | "saved" | "error"; errors?: Record<string, string>; message?: string };

/** Updates the caller's own buyer profile. The id comes from the session, never from the form; role is never written. */
export async function updateBuyerProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const { user } = await requireBuyer();
  const parsed = parseBuyerProfile(Object.fromEntries(formData.entries()));
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update(parsed.value).eq("id", user.id);
  if (error) return { status: "error", message: "No pudimos guardar tu perfil. Inténtalo de nuevo." };

  revalidatePath("/mis-recetarios", "layout");
  return { status: "saved" };
}
