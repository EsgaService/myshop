import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Category, Recipe, Section, Store } from "./types";

const STORE_COLUMNS =
  "id,slug,name,tagline,description,logo_url,cover_url,primary_color,secondary_color,background_color,text_color,font,price_cents,currency,teaser";

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export const listStores = cache(async (): Promise<Store[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("stores").select(STORE_COLUMNS).order("name");
  return (data ?? []) as Store[];
});

export const getStore = cache(async (slug: string): Promise<Store | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("stores").select(STORE_COLUMNS).eq("slug", slug).maybeSingle();
  return (data as Store | null) ?? null;
});

/** Store ids the current user purchased. RLS limits rows to the caller. */
export const listPurchasedStoreIds = cache(async (): Promise<Set<string>> => {
  const user = await getCurrentUser();
  if (!user) return new Set();
  const supabase = await createClient();
  const { data } = await supabase.from("purchases").select("store_id");
  return new Set((data ?? []).map((r) => r.store_id as string));
});

export async function hasPurchased(storeId: string): Promise<boolean> {
  return (await listPurchasedStoreIds()).has(storeId);
}

export async function getBook(storeId: string) {
  const supabase = await createClient();
  const [categories, sections, recipes] = await Promise.all([
    supabase.from("recipe_categories").select("id,slug,name,description,position").eq("store_id", storeId).order("position"),
    supabase.from("book_sections").select("id,position,title,blocks").eq("store_id", storeId).order("position"),
    supabase
      .from("recipes")
      .select("id,slug,title,category_id,position,photo_path,photo_people_path,yield_text,yield_servings,time_text,ingredients,steps,notes,extras")
      .eq("store_id", storeId)
      .order("position"),
  ]);
  return {
    categories: (categories.data ?? []) as Category[],
    sections: (sections.data ?? []) as Section[],
    recipes: (recipes.data ?? []) as Recipe[],
  };
}
