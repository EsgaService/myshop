import { roleHome } from "@/lib/account/decide-post-login";
import type { AccountRole } from "@/lib/account/decide-role";

/** Copy and routing for the two public auth screens (neutral Spanish, tuteo). */
export type AuthScreen = {
  as: AccountRole;
  title: string;
  text: string;
  note: string;
  defaultNext: string;
  switchLink: { label: string; href: string };
};

const SCREENS: Record<AccountRole, AuthScreen> = {
  buyer: {
    as: "buyer",
    title: "Entra a tus recetarios",
    text: "Lee los recetarios que compraste y descubre otros nuevos de cocineros y reposteros.",
    note: "Si no tienes cuenta, la creamos automáticamente al entrar con Google. Las cuentas de comprador y de vendedor son distintas.",
    defaultNext: roleHome("buyer"),
    switchLink: { label: "¿Quieres vender tus recetas? Entra como vendedor", href: "/vendedor/ingresar" },
  },
  seller: {
    as: "seller",
    title: "Vende tus recetarios",
    text: "Sube tus PDF, ponles precio y comparte tu tienda. Prepáralo todo antes de suscribirte.",
    note: "Si no tienes cuenta de vendedor, la creamos automáticamente al entrar con Google. Las cuentas de comprador y de vendedor son distintas.",
    defaultNext: roleHome("seller"),
    switchLink: { label: "¿Quieres comprar recetarios? Entra como comprador", href: "/ingresar" },
  },
};

export function authScreen(role: AccountRole): AuthScreen {
  return SCREENS[role];
}

/**
 * A logged-in user on the other role's screen is never switched: they are sent
 * to their own home with a notice. Returns null when nothing needs to happen.
 */
export function wrongScreenRedirect({ role, screen }: { role: AccountRole | null; screen: AccountRole }): string | null {
  if (!role || role === screen) return null;
  return `${roleHome(role)}?aviso=rol`;
}

/** Notice banner text for the `?aviso=` query param. Unknown codes yield null. */
export function avisoMessage(code: string | undefined, role: AccountRole): string | null {
  if (code === "rol") {
    return role === "buyer"
      ? "Tu cuenta es de comprador, por eso no puedes usar el área de vendedor. Para vender necesitas otra cuenta de Google."
      : "Tu cuenta es de vendedor, por eso no puedes usar el área de comprador. Para comprar necesitas otra cuenta de Google.";
  }
  if (code === "vendedor") {
    return "Tu cuenta es de vendedor, por eso no puedes comprar recetarios. Para comprar necesitas una cuenta de comprador.";
  }
  return null;
}
