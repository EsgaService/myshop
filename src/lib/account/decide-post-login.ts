import { safeNextPath } from "@/lib/auth/safe-next";
import type { AccountRole } from "./decide-role";

export function roleHome(role: AccountRole): string {
  return role === "seller" ? "/vendedor" : "/mis-recetarios";
}

const isSellerArea = (path: string) => path === "/vendedor" || path.startsWith("/vendedor/") || path.startsWith("/vendedor?");

/** Buyer-only destinations: the library and any book checkout (/<seller>/<book>/pagar). */
function isBuyerArea(path: string): boolean {
  const pathname = path.split(/[?#]/)[0];
  if (pathname === "/mis-recetarios" || pathname.startsWith("/mis-recetarios/")) return true;
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 3 && segments[2] === "pagar";
}

/**
 * Where to send a user after login. `next` is only honored when it is a safe
 * same-origin path that belongs to an area the role may use.
 */
export function decidePostLogin(input: { role: AccountRole; next: string | null | undefined; mismatch: boolean }): string {
  const home = roleHome(input.role);
  if (input.mismatch) return `${home}?aviso=rol`;

  const next = safeNextPath(input.next, home);
  if (input.role === "buyer" && isSellerArea(next)) return home;
  if (input.role === "seller" && isBuyerArea(next)) return home;
  return next;
}
