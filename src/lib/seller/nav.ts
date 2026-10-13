export type SellerNavItem = { label: string; href: string };

/** Seller sidebar. Sellers only see their own area: no marketplace or buyer links. */
export function sellerNav(): SellerNavItem[] {
  return [
    { label: "Panel", href: "/vendedor" },
    { label: "Productos", href: "/vendedor/productos" },
    { label: "Perfil", href: "/vendedor/perfil" },
    { label: "Suscripción", href: "/vendedor/suscripcion" },
    { label: "Cuenta para pagos", href: "/vendedor/pagos" },
  ];
}
