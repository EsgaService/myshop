export type DeleteProductReason = "sold" | "published" | "archived" | "has_pdfs";
export type DeleteProductDecision = { ok: true } | { ok: false; reason: DeleteProductReason };

/**
 * Only empty drafts without purchases can be deleted (R5.2). Purchases win over every other reason:
 * a sold book is never deletable (`purchases.book_id` is also `on delete restrict` as the backstop).
 */
export function decideDeleteProduct(input: {
  status: "draft" | "published" | "archived";
  hasPurchases: boolean;
  activeUploadCount: number;
}): DeleteProductDecision {
  if (input.hasPurchases) return { ok: false, reason: "sold" };
  if (input.status === "published") return { ok: false, reason: "published" };
  if (input.status === "archived") return { ok: false, reason: "archived" };
  if (input.activeUploadCount > 0) return { ok: false, reason: "has_pdfs" };
  return { ok: true };
}

export function deleteProductErrorMessage(reason: DeleteProductReason): string {
  switch (reason) {
    case "sold":
      return "Este producto ya tiene compras y no se puede eliminar.";
    case "published":
      return "Un producto publicado no se puede eliminar. Despublícalo primero.";
    case "archived":
      return "Este producto está archivado y no se puede eliminar.";
    case "has_pdfs":
      return "Elimina primero los PDF del producto.";
  }
}
