export const SLUG_LOCKED_MESSAGE =
  "No puedes cambiar el enlace de tu tienda mientras tengas recetarios publicados, porque los enlaces que ya compartiste dejarían de funcionar.";

export type SlugChangeDecision = { ok: true } | { ok: false; reason: "locked" };

/** The store slug is part of every shared book URL: it is frozen while any book is published. */
export function decideSlugChange(input: {
  currentSlug: string;
  newSlug: string;
  publishedBookCount: number;
}): SlugChangeDecision {
  if (input.newSlug === input.currentSlug) return { ok: true };
  if (input.publishedBookCount > 0) return { ok: false, reason: "locked" };
  return { ok: true };
}
