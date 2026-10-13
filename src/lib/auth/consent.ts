/** Legal consent required before starting Google sign-in. */
export const CONSENT = {
  terms: { label: "Términos y condiciones", href: "/terminos" },
  privacy: { label: "Política de privacidad", href: "/privacidad" },
  error: "Debes aceptar los términos para continuar",
} as const;

/** Sign-in may only start once the user has accepted the terms. */
export function canStartLogin(accepted: boolean): boolean {
  return accepted === true;
}
