/** Lowercase, strip diacritics, turn everything that is not a letter or digit into one space. */
export function normalizeTitle(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Unique tokens of the normalized title, in first-seen order. */
export function titleTokens(input: string): string[] {
  const normalized = normalizeTitle(input);
  return normalized === "" ? [] : [...new Set(normalized.split(" "))];
}

/** Jaccard similarity of the token sets, 0 when either side has no tokens. */
export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = new Set(titleTokens(b));
  if (ta.length === 0 || tb.size === 0) return 0;
  const shared = ta.filter((t) => tb.has(t)).length;
  return shared / (ta.length + tb.size - shared);
}
