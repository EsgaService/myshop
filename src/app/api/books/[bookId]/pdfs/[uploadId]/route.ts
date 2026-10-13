import { NextResponse } from "next/server";
import { resolveDownload } from "@/lib/books/download-core";
import { getCurrentUser } from "@/lib/data/queries";
import { createPdfDownloadUrl } from "@/lib/ingestion/storage";
import { createAdminClient } from "@/lib/supabase/admin";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Original PDF of a book: 302 to a 60 s signed URL for the owner seller or a buyer with a purchase.
 * Every denial is a bare 404, and the storage path never appears in a response.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ bookId: string; uploadId: string }> }) {
  const { bookId, uploadId } = await params;
  const admin = createAdminClient();

  const result = await resolveDownload(
    {
      async getUserId() {
        return (await getCurrentUser())?.id ?? null;
      },
      async loadUpload(id) {
        const { data } = await admin
          .from("book_uploads")
          .select("book_id,seller_id,status,removed_at,original_name,storage_path")
          .eq("id", id)
          .maybeSingle();
        return data ?? null;
      },
      async isOwner(userId, sellerId) {
        const { data } = await admin.from("sellers").select("id").eq("id", sellerId).eq("user_id", userId).maybeSingle();
        return Boolean(data);
      },
      async hasPurchase(userId, id) {
        const { data } = await admin.from("purchases").select("id").eq("user_id", userId).eq("book_id", id).maybeSingle();
        return Boolean(data);
      },
      createSignedUrl: createPdfDownloadUrl,
    },
    { bookId, uploadId },
  );

  if (result.kind === "not_found") return new NextResponse(null, { status: 404, headers: NO_STORE });
  return new NextResponse(null, { status: 302, headers: { ...NO_STORE, Location: result.url } });
}
