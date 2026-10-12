export type StoreRoute = "landing" | "checkout" | "book";

export type AccessInput = {
  slug: string;
  route: StoreRoute;
  isAuthenticated: boolean;
  hasPurchase: boolean;
};

export type AccessDecision = { kind: "allow" } | { kind: "redirect"; to: string };

/**
 * Pure routing decision for a store. The caller is responsible for computing
 * `hasPurchase` from the database (never from the client).
 */
export function decideAccess({ slug, route, isAuthenticated, hasPurchase }: AccessInput): AccessDecision {
  const landing = `/${slug}`;
  const checkout = `/${slug}/pagar`;
  const book = `/${slug}/recetario`;

  // A purchase flag is meaningless without an authenticated user.
  const buyer = isAuthenticated && hasPurchase;

  switch (route) {
    case "landing":
      if (!isAuthenticated) return { kind: "allow" };
      return { kind: "redirect", to: buyer ? book : checkout };
    case "checkout":
      if (!isAuthenticated) return { kind: "redirect", to: landing };
      return buyer ? { kind: "redirect", to: book } : { kind: "allow" };
    case "book":
      if (!isAuthenticated) return { kind: "redirect", to: landing };
      return buyer ? { kind: "allow" } : { kind: "redirect", to: checkout };
  }
}
