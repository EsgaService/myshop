import "server-only";
import type { AccountRole } from "@/lib/account/decide-role";
import { getBookBySlugs, getCurrentUser, getMySeller, getProfile, hasPurchasedBook } from "@/lib/data/queries";
import type { BookWithSeller } from "@/lib/data/types";
import { getSellerAccess } from "@/lib/seller/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAccessInput, decideAccess } from "./book-context";
import type { AccessDecision, AccessInput, BookRoute } from "./decide-access";

export type BookContext =
  | { kind: "missing" }
  /** A published book exists but is not visible to this viewer (seller lapsed or unpublished). */
  | { kind: "unavailable" }
  | {
      kind: "ready";
      book: BookWithSeller;
      role: AccountRole | null;
      email: string | null;
      input: AccessInput;
      decision: AccessDecision;
    };

async function publishedBookExists(sellerSlug: string, bookSlug: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: seller } = await admin.from("sellers").select("id").eq("slug", sellerSlug).maybeSingle();
  if (!seller) return false;
  const { data } = await admin
    .from("books")
    .select("id")
    .eq("seller_id", seller.id)
    .eq("slug", bookSlug)
    .eq("status", "published")
    .maybeSingle();
  return Boolean(data);
}

/** Loads everything a book page needs and runs the single access decision for `route`. */
export async function loadBookContext(sellerSlug: string, bookSlug: string, route: BookRoute): Promise<BookContext> {
  const book = await getBookBySlugs(sellerSlug, bookSlug);
  if (!book) return { kind: (await publishedBookExists(sellerSlug, bookSlug)) ? "unavailable" : "missing" };

  const user = await getCurrentUser();
  const profile = user ? await getProfile() : null;
  const role = profile?.role ?? null;
  const [mySeller, hasPurchase, sellerAccess] = await Promise.all([
    role === "seller" ? getMySeller() : Promise.resolve(null),
    role === "buyer" ? hasPurchasedBook(book.id) : Promise.resolve(false),
    getSellerAccess(book.seller_id, book.seller.is_platform),
  ]);

  const input = buildAccessInput({ route, role, mySellerId: mySeller?.id ?? null, hasPurchase, book, sellerAccess });
  return { kind: "ready", book, role, email: user?.email ?? null, input, decision: decideAccess(input) };
}
