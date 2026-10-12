import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Book, BookWithSeller, Category, Profile, Recipe, Section, Seller, SellerUpload, UploadJob } from "./types";

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

/** Recipes, sections and categories of a book (book id == legacy store id). RLS limits rows to buyers/owner. */
export async function getBook(storeId: string) {
  const supabase = await createClient();
  const [categories, sections, recipes] = await Promise.all([
    supabase.from("recipe_categories").select("id,slug,name,description,position").eq("book_id", storeId).order("position"),
    supabase.from("book_sections").select("id,position,title,blocks").eq("book_id", storeId).order("position"),
    supabase
      .from("recipes")
      .select("id,slug,title,category_id,position,photo_path,photo_people_path,yield_text,yield_servings,time_text,ingredients,steps,notes,extras")
      .eq("book_id", storeId)
      .order("position"),
  ]);
  return {
    categories: (categories.data ?? []) as Category[],
    sections: (sections.data ?? []) as Section[],
    recipes: (recipes.data ?? []) as Recipe[],
  };
}

// ---------------------------------------------------------------------------
// Marketplace queries (all run under the caller's RLS)
// ---------------------------------------------------------------------------

const BOOK_COLUMNS =
  "id,seller_id,slug,title,tagline,description,cover_url,primary_color,secondary_color,background_color,text_color,font,price_cents,currency,teaser,status,published_at";
const SELLER_COLUMNS = "id,slug,store_name,bio,avatar_url,city,instagram,whatsapp,is_platform";
const BOOK_WITH_SELLER = `${BOOK_COLUMNS},seller:sellers!inner(id,slug,store_name,is_platform)`;

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,role,display_name,avatar_url,phone,city")
    .eq("id", user.id)
    .maybeSingle();
  return (data as Profile | null) ?? null;
});

/**
 * The seller row owned by the current user, if any. Clients cannot read `sellers.user_id`
 * (column-level grant), so the owner lookup uses the service role keyed by the verified session user.
 */
export const getMySeller = cache(async (): Promise<Seller | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await createAdminClient().from("sellers").select(SELLER_COLUMNS).eq("user_id", user.id).maybeSingle();
  return (data as Seller | null) ?? null;
});

export const getSellerBySlug = cache(async (slug: string): Promise<Seller | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("sellers").select(SELLER_COLUMNS).eq("slug", slug).maybeSingle();
  return (data as Seller | null) ?? null;
});

/** Published books of a seller. RLS already hides them when the seller is not live. */
export const listPublishedBooksBySeller = cache(async (sellerId: string): Promise<Book[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("books")
    .select(BOOK_COLUMNS)
    .eq("seller_id", sellerId)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  return (data ?? []) as unknown as Book[];
});

/** Marketplace listing (R17): published books of live sellers. */
export const listListedBooks = cache(async (): Promise<BookWithSeller[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("books")
    .select(BOOK_WITH_SELLER)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  return (data ?? []) as unknown as BookWithSeller[];
});

/**
 * A book addressed by /<seller>/<book>. Resolved in two steps (seller, then book by
 * seller_id) instead of filtering on an embedded resource, which is easy to get wrong.
 * RLS decides visibility: published + live seller, own book, or purchased.
 */
export const getBookBySlugs = cache(async (sellerSlug: string, bookSlug: string): Promise<BookWithSeller | null> => {
  const seller = await getSellerBySlug(sellerSlug);
  if (!seller) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("books")
    .select(BOOK_COLUMNS)
    .eq("seller_id", seller.id)
    .eq("slug", bookSlug)
    .maybeSingle();
  if (!data) return null;
  const { id, slug, store_name, is_platform } = seller;
  return { ...(data as unknown as Book), seller: { id, slug, store_name, is_platform } };
});

/** A book by id, with its seller. RLS decides visibility (published + live seller, own book, or purchased). */
export async function getBookById(bookId: string): Promise<BookWithSeller | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("books").select(BOOK_WITH_SELLER).eq("id", bookId).maybeSingle();
  return (data as unknown as BookWithSeller | null) ?? null;
}

/** Book ids the current user purchased. RLS limits rows to the caller. */
export const listPurchasedBookIds = cache(async (): Promise<Set<string>> => {
  const user = await getCurrentUser();
  if (!user) return new Set();
  const supabase = await createClient();
  const { data } = await supabase.from("purchases").select("book_id");
  return new Set((data ?? []).map((r) => r.book_id as string));
});

export async function hasPurchasedBook(bookId: string): Promise<boolean> {
  return (await listPurchasedBookIds()).has(bookId);
}

/** Books owned (purchased) by the current user, for the buyer sidebar. */
export const listOwnedBooks = cache(async (): Promise<BookWithSeller[]> => {
  const ids = [...(await listPurchasedBookIds())];
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("books").select(BOOK_WITH_SELLER).in("id", ids).order("title");
  return (data ?? []) as unknown as BookWithSeller[];
});

/** Every book of the current seller (drafts included). RLS limits rows to the owner. */
export const listMyBooks = cache(async (sellerId: string): Promise<Book[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("books")
    .select(BOOK_COLUMNS)
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as Book[];
});

// ---------------------------------------------------------------------------
// Seller uploads and ingestion (owner-only under RLS)
// ---------------------------------------------------------------------------

/** Active (not removed) uploads of the current seller, newest first. */
export const listMyUploads = cache(async (sellerId: string): Promise<SellerUpload[]> => {
  const supabase = await createClient();
  const { data: uploads } = await supabase
    .from("book_uploads")
    .select("id,original_name,size_bytes,status,book_id,error,created_at")
    .eq("seller_id", sellerId)
    .is("removed_at", null)
    .order("created_at", { ascending: false });
  const rows = (uploads ?? []) as unknown as Omit<SellerUpload, "job">[];
  if (rows.length === 0) return [];

  // Two queries instead of an embedded resource: the one-to-one embed shape is easy to misread.
  const { data: jobs } = await supabase
    .from("ingestion_jobs")
    .select("id,upload_id,status,attempts,max_attempts,last_error")
    .in(
      "upload_id",
      rows.map((r) => r.id),
    );
  const byUpload = new Map((jobs ?? []).map((j) => [j.upload_id as string, j as unknown as UploadJob]));
  return rows.map((r) => ({ ...r, job: byUpload.get(r.id) ?? null }));
});
