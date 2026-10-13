/**
 * Top-level route names that a seller slug must never take.
 * Mirrored in the SQL check on public.sellers (migration marketplace_schema).
 */
export const RESERVED_SLUGS: readonly string[] = Object.freeze([
  "api",
  "auth",
  "login",
  "ingresar",
  "vendedor",
  "mis-recetarios",
  "explorar",
  "privacidad",
  "terminos",
  "admin",
  "ayuda",
  "precios",
  "myshop",
  "cocteles",
  "micheladas",
  "pagos",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.trim().toLowerCase());
}
