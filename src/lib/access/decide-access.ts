import { authPath } from "@/lib/auth/auth-mode";

export type BookRoute = "landing" | "checkout" | "book";
export type Viewer = "anon" | "buyer" | "seller";

export type AccessInput = {
  paths: { landing: string; checkout: string; book: string };
  route: BookRoute;
  viewer: Viewer;
  hasPurchase: boolean;
  /** The viewer is the seller who owns the book. */
  isOwner: boolean;
  /** The owning seller may currently sell (active subscription or platform). */
  sellable: boolean;
};

export type AccessDecision = { kind: "allow" } | { kind: "redirect"; to: string };

const redirect = (to: string): AccessDecision => ({ kind: "redirect", to });
const allow: AccessDecision = { kind: "allow" };

/**
 * Pure routing decision for a book. The caller computes `viewer`, `hasPurchase`,
 * `isOwner` and `sellable` from the database (never from the client).
 */
export function decideAccess({ paths, route, viewer, hasPurchase, isOwner, sellable }: AccessInput): AccessDecision {
  // A purchase only counts for a logged-in buyer. Sellers never buy.
  const owned = viewer === "buyer" && hasPurchase;

  switch (route) {
    case "landing":
      return owned ? redirect(paths.book) : allow;
    case "checkout":
      if (viewer === "anon") return redirect(authPath("buyer", "crear", { next: paths.checkout }));
      if (viewer === "seller") return redirect(`${paths.landing}?aviso=vendedor`);
      if (owned) return redirect(paths.book);
      return sellable ? allow : redirect(paths.landing);
    case "book":
      if (viewer === "anon") return redirect(paths.landing);
      if (viewer === "seller") return isOwner ? allow : redirect(paths.landing);
      return owned ? allow : redirect(paths.checkout);
  }
}
