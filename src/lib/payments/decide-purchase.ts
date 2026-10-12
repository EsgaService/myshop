import type { AccountRole } from "@/lib/account/decide-role";
import type { SellerAccess } from "@/lib/seller/decide-subscription";

export type PurchaseDecision =
  | { kind: "allow" }
  | { kind: "already-owned" }
  | { kind: "deny"; status: 401 | 403 | 404 | 409; error: string };

const deny = (status: 401 | 403 | 404 | 409, error: string): PurchaseDecision => ({ kind: "deny", status, error });

/**
 * Server-side gate for POST /api/pay/book/[bookId]. Roles are exclusive:
 * sellers never buy. A lapsed seller or an unpublished book blocks new sales,
 * but never removes access a buyer already has.
 */
export function decidePurchase(input: {
  role: AccountRole | null;
  book: { status: "draft" | "published" | "archived" } | null;
  sellerAccess: SellerAccess;
  alreadyOwned: boolean;
}): PurchaseDecision {
  if (!input.role) return deny(401, "Debes iniciar sesión.");
  if (input.role !== "buyer") return deny(403, "Las cuentas de vendedor no pueden comprar recetarios.");
  if (!input.book) return deny(404, "Recetario no encontrado.");
  if (input.alreadyOwned) return { kind: "already-owned" };
  if (input.book.status !== "published" || !input.sellerAccess.canSell) {
    return deny(409, "Este recetario no está disponible para la venta por ahora.");
  }
  return { kind: "allow" };
}
