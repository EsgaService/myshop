import "server-only";
import { isUuid } from "@/lib/ids";
import { createAdminClient } from "@/lib/supabase/admin";

export type OwnedBook = { id: string; slug: string; status: "draft" | "published" | "archived"; price_cents: number };
export type OwnedUpload = {
  id: string;
  storage_path: string;
  status: "pending" | "uploaded" | "processing" | "ready" | "failed";
  book_id: string | null;
};

/**
 * Ownership lookups for server actions. They use the service role, so the
 * `seller_id` filter IS the authorization: callers pass the id from requireSeller().
 */
export async function getOwnedBook(sellerId: string, bookId: unknown): Promise<OwnedBook | null> {
  if (!isUuid(bookId)) return null;
  const { data, error } = await createAdminClient()
    .from("books")
    .select("id,slug,status,price_cents")
    .eq("id", bookId)
    .eq("seller_id", sellerId)
    .maybeSingle();
  if (error) throw new Error(`book lookup failed: ${error.message}`);
  return (data as OwnedBook | null) ?? null;
}

export async function getOwnedUpload(sellerId: string, uploadId: unknown): Promise<OwnedUpload | null> {
  if (!isUuid(uploadId)) return null;
  const { data, error } = await createAdminClient()
    .from("book_uploads")
    .select("id,storage_path,status,book_id")
    .eq("id", uploadId)
    .eq("seller_id", sellerId)
    .is("removed_at", null)
    .maybeSingle();
  if (error) throw new Error(`upload lookup failed: ${error.message}`);
  return (data as OwnedUpload | null) ?? null;
}
