export type TeaserPhotoRow = { title: string; photo_path: string | null };

function normalize(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Picks the `photo_path` of the recipe whose title matches the teaser sample title, or null. */
export function pickTeaserPhotoPath(rows: TeaserPhotoRow[], sampleTitle: string | null | undefined): string | null {
  const wanted = sampleTitle ? normalize(sampleTitle) : "";
  if (!wanted) return null;
  const hit = rows.find((r) => r.photo_path && normalize(r.title) === wanted);
  return hit?.photo_path ?? null;
}
