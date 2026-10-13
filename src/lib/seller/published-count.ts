import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Number of currently published books of a seller (service role; callers pass the session's seller id). */
export async function countPublishedBooks(sellerId: string): Promise<number> {
  const { count, error } = await createAdminClient()
    .from("books")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", sellerId)
    .eq("status", "published");
  if (error) throw new Error(`published books count failed: ${error.message}`);
  return count ?? 0;
}
