import "server-only";
import { photoUrl } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickTeaserPhotoPath } from "./teaser-photo";

/**
 * Public URL of the teaser sample recipe photo. Read with the service role because recipes are RLS-protected
 * for non-buyers; only the photo path of the one sample recipe is exposed (the photos bucket is public).
 */
export async function loadTeaserPhotoUrl(bookId: string, sampleTitle: string | null | undefined): Promise<string | null> {
  if (!sampleTitle) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("recipes").select("title,photo_path").eq("book_id", bookId).not("photo_path", "is", null);
  return photoUrl(pickTeaserPhotoPath(data ?? [], sampleTitle));
}
