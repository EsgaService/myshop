import { safeNextPath } from "@/lib/auth/safe-next";
import type { AccountRole } from "@/lib/account/decide-role";
import { CONSENT } from "./consent";

/** `crear` = sign up (terms required), `ingresar` = sign in (no terms). */
export type AuthMode = "crear" | "ingresar";

/** Untrusted `modo` search param. Anything but an exact "crear" is sign-in. */
export function parseAuthMode(value: string | string[] | null | undefined): AuthMode {
  return value === "crear" ? "crear" : "ingresar";
}

const BASE: Record<AccountRole, string> = { buyer: "/ingresar", seller: "/vendedor/ingresar" };

/** URL of an auth screen. The mode param is only written for sign-up. */
export function authPath(role: AccountRole, mode: AuthMode, opts: { next?: string | null; aviso?: string } = {}): string {
  const params: string[] = [];
  if (mode === "crear") params.push("modo=crear");
  if (opts.aviso) params.push(`aviso=${encodeURIComponent(opts.aviso)}`);
  if (opts.next) params.push(`next=${encodeURIComponent(opts.next)}`);
  return params.length ? `${BASE[role]}?${params.join("&")}` : BASE[role];
}

export type AccountCreationDecision = "signin" | "create" | "requireSignup";

/**
 * Server-side rule behind the terms checkbox: an existing account always signs
 * in; a new one is created only when the sign-up flow sent explicit consent.
 */
export function decideAccountCreation(input: { hasProfile: boolean; consent: string | null | undefined }): AccountCreationDecision {
  if (input.hasProfile) return "signin";
  return input.consent === CONSENT.param.value ? "create" : "requireSignup";
}

/** Where to send a user who tried to sign in without an account (and without consent). */
export function signupRequiredPath(input: { intent: string | null | undefined; next: string | null | undefined }): string {
  const role: AccountRole = input.intent === "seller" ? "seller" : "buyer";
  const next = safeNextPath(input.next, "");
  return authPath(role, "crear", { aviso: "crear-cuenta", next: next || null });
}
