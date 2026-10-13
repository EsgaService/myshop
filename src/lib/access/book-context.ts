import type { AccountRole } from "@/lib/account/decide-role";
import { bookPaths } from "@/lib/books/share-links";
import type { SellerAccess } from "@/lib/seller/decide-subscription";
import { decideAccess, type AccessInput, type BookRoute } from "./decide-access";

type BookRef = { id: string; seller_id: string; slug: string; status: "draft" | "published" | "archived"; seller: { slug: string } };

/**
 * Builds the decideAccess input from database facts. Every flag is computed
 * server-side: a purchase only counts for a buyer, ownership only for the
 * seller row that owns the book.
 */
export function buildAccessInput(args: {
  route: BookRoute;
  role: AccountRole | null;
  mySellerId: string | null;
  hasPurchase: boolean;
  book: BookRef;
  sellerAccess: SellerAccess;
}): AccessInput {
  const { route, role, mySellerId, hasPurchase, book, sellerAccess } = args;
  const viewer = role ?? "anon";
  return {
    paths: bookPaths(book.seller.slug, book.slug),
    route,
    viewer,
    hasPurchase: viewer === "buyer" && hasPurchase,
    isOwner: viewer === "seller" && mySellerId !== null && mySellerId === book.seller_id,
    sellable: book.status === "published" && sellerAccess.canSell,
  };
}

export { decideAccess };
