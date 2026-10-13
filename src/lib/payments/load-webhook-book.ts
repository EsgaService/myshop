import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Book status straight from the database (service role), to decide whether a paid purchase can be fulfilled. */
export async function loadBookForWebhook(bookId: string) {
  const { data: book, error } = await createAdminClient().from("books").select("status").eq("id", bookId).maybeSingle();
  if (error) throw new Error(`Could not load book for webhook: ${error.message}`);
  return { book: book ? { status: book.status as "draft" | "published" | "archived" } : null };
}
