export function storePath(sellerSlug: string): string {
  return `/${sellerSlug}`;
}

/** Public paths of a book: share link (`landing`), checkout and reader. */
export function bookPaths(sellerSlug: string, bookSlug: string) {
  const base = `/${sellerSlug}/${bookSlug}`;
  return { landing: base, checkout: `${base}/pagar`, book: `${base}/recetario` };
}

export function absoluteUrl(path: string, siteUrl: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
