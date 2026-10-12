import { bookPaths } from "@/lib/books/share-links";

export type BuyerNavItem = { label: string; href: string };

type OwnedBook = { title: string; slug: string; seller: { slug: string } };

/**
 * Buyer sidebar (R16): library, owned books, profile, and the marketplace CTA
 * kept apart as `footerLink` so it always renders last.
 */
export function buyerNav(owned: readonly OwnedBook[]): { nav: BuyerNavItem[]; footerLink: BuyerNavItem } {
  return {
    nav: [
      { label: "Mis recetarios", href: "/mis-recetarios" },
      ...owned.map((b) => ({ label: b.title, href: bookPaths(b.seller.slug, b.slug).book })),
      { label: "Perfil", href: "/mis-recetarios/perfil" },
    ],
    footerLink: { label: "Obtener más recetas", href: "/explorar" },
  };
}
