import { roleHome } from "@/lib/account/decide-post-login";
import type { AccountRole } from "@/lib/account/decide-role";

export type Area = "buyer" | "seller";
export type AreaDecision = { kind: "allow" } | { kind: "redirect"; to: string };

/** Roles are exclusive: each area is reachable only by its own role. `role` null means anonymous. */
export function decideArea({ role, area }: { role: AccountRole | null; area: Area }): AreaDecision {
  if (!role) return { kind: "redirect", to: area === "seller" ? "/vendedor/ingresar" : "/ingresar" };
  if (role === area) return { kind: "allow" };
  return { kind: "redirect", to: `${roleHome(role)}?aviso=rol` };
}
