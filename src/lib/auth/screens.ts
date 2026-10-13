import { roleHome } from "@/lib/account/decide-post-login";
import type { AccountRole } from "@/lib/account/decide-role";
import { authPath, type AuthMode } from "@/lib/auth/auth-mode";

/** Copy and routing for the two public auth screens (neutral Spanish, tuteo). */
export type AuthScreen = {
  as: AccountRole;
  mode: AuthMode;
  title: string;
  text: string;
  note: string;
  defaultNext: string;
  /** Sign-up asks for the terms; sign-in never does. */
  requiresConsent: boolean;
  /** Same role, opposite mode. */
  modeLink: { label: string; href: string };
  /** Other role, same mode. */
  switchLink: { label: string; href: string };
};

const COPY: Record<AccountRole, { title: Record<AuthMode, string>; text: string; switchLabel: Record<AuthMode, string> }> = {
  buyer: {
    title: { ingresar: "Inicia sesión", crear: "Crea tu cuenta" },
    text: "Lee los recetarios que compraste y descubre otros nuevos de cocineros y reposteros.",
    switchLabel: {
      ingresar: "¿Quieres vender tus recetas? Entra como vendedor",
      crear: "¿Quieres vender tus recetas? Crea una cuenta de vendedor",
    },
  },
  seller: {
    title: { ingresar: "Inicia sesión en tu tienda", crear: "Crea tu cuenta de vendedor" },
    text: "Sube tus PDF, ponles precio y comparte tu tienda. Prepáralo todo antes de suscribirte.",
    switchLabel: {
      ingresar: "¿Quieres comprar recetarios? Entra como comprador",
      crear: "¿Quieres comprar recetarios? Crea una cuenta de comprador",
    },
  },
};

const NOTE: Record<AuthMode, string> = {
  ingresar: "Las cuentas de comprador y de vendedor son distintas.",
  crear: "Crearemos tu cuenta con tu cuenta de Google. Las cuentas de comprador y de vendedor son distintas.",
};

const OTHER: Record<AccountRole, AccountRole> = { buyer: "seller", seller: "buyer" };

/** `next` is only used for the same-screen mode link (the other-role link drops it). */
export function authScreen(role: AccountRole, mode: AuthMode = "ingresar", next?: string | null): AuthScreen {
  const copy = COPY[role];
  const otherMode: AuthMode = mode === "crear" ? "ingresar" : "crear";
  return {
    as: role,
    mode,
    title: copy.title[mode],
    text: copy.text,
    note: NOTE[mode],
    defaultNext: roleHome(role),
    requiresConsent: mode === "crear",
    modeLink: {
      label: mode === "crear" ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Crea una",
      href: authPath(role, otherMode, { next }),
    },
    switchLink: { label: copy.switchLabel[mode], href: authPath(OTHER[role], mode) },
  };
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
export function avisoMessage(code: string | undefined, role: AccountRole | null): string | null {
  if (code === "crear-cuenta") return "Aún no tienes cuenta. Acepta los términos para crearla.";
  if (code === "rol" && role) {
    return role === "buyer"
      ? "Tu cuenta es de comprador, por eso no puedes usar el área de vendedor. Para vender necesitas otra cuenta de Google."
      : "Tu cuenta es de vendedor, por eso no puedes usar el área de comprador. Para comprar necesitas otra cuenta de Google.";
  }
  if (code === "vendedor" && role) {
    return "Tu cuenta es de vendedor, por eso no puedes comprar recetarios. Para comprar necesitas una cuenta de comprador.";
  }
  return null;
}
