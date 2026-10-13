import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { toBookPdfs, type BookPdf } from "./pdf-download";

/**
 * Downloadable PDFs of a book (ready and not removed), oldest first. `book_uploads` is seller-only under RLS,
 * so this reads with the service role: call it ONLY after the access decision allowed reading the book.
 * The result carries no storage path.
 */
export async function listBookPdfs(bookId: string): Promise<BookPdf[]> {
  const { data, error } = await createAdminClient()
    .from("book_uploads")
    .select("id,original_name,size_bytes")
    .eq("book_id", bookId)
    .eq("status", "ready")
    .is("removed_at", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) {
    console.error("could not list book PDFs", error.message);
    return [];
  }
  return toBookPdfs((data ?? []) as { id: string; original_name: string; size_bytes: number }[]);
}
