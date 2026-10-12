import "server-only";
import { getSellerAccess } from "@/lib/seller/access";
import { createAdminClient } from "@/lib/supabase/admin";

/** Book price/status and seller liveness straight from the database (service role), for webhook validation. */
export async function loadBookForWebhook(bookId: string) {
  const admin = createAdminClient();
  const { data: book, error } = await admin
    .from("books")
    .select("status,price_cents,currency,seller_id")
    .eq("id", bookId)
    .maybeSingle();
  if (error) throw new Error(`Could not load book for webhook: ${error.message}`);
  if (!book) return { book: null, sellerCanSell: false };

  const { data: seller, error: sellerError } = await admin
    .from("sellers")
    .select("is_platform")
    .eq("id", book.seller_id as string)
    .maybeSingle();
  if (sellerError) throw new Error(`Could not load seller for webhook: ${sellerError.message}`);
  const access = await getSellerAccess(book.seller_id as string, Boolean(seller?.is_platform));

  return {
    book: {
      status: book.status as "draft" | "published" | "archived",
      priceCents: book.price_cents as number,
      currency: book.currency as string,
    },
    sellerCanSell: access.canSell,
  };
}
