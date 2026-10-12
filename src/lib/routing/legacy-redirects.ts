/**
 * Legacy single-store URLs (/cocteles/..., /micheladas/...) now live under the
 * platform seller: /myshop/<slug>/... These slugs are reserved so no seller can
 * shadow them.
 */
export const LEGACY_BOOK_SLUGS: readonly string[] = Object.freeze(["cocteles", "micheladas"]);

export const PLATFORM_SELLER_SLUG = "myshop";

export type RedirectRule = { source: string; destination: string; permanent: boolean };

/** Permanent (308) redirects consumed by next.config.ts. */
export function legacyRedirects(): RedirectRule[] {
  return LEGACY_BOOK_SLUGS.map((slug) => ({
    source: `/${slug}/:path*`,
    destination: `/${PLATFORM_SELLER_SLUG}/${slug}/:path*`,
    permanent: true,
  }));
}
