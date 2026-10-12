import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const PDF_BUCKET = "seller-pdfs";

export { pdfPath } from "./pdf-path";

export async function createPdfUploadUrl(path: string): Promise<{ signedUrl: string; token: string }> {
  const { data, error } = await createAdminClient().storage.from(PDF_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Could not create upload URL: ${error?.message ?? "unknown"}`);
  return { signedUrl: data.signedUrl, token: data.token };
}

/** Size in bytes of an existing object, or null when it is missing. */
export async function getPdfSize(path: string): Promise<number | null> {
  const slash = path.lastIndexOf("/");
  const { data, error } = await createAdminClient()
    .storage.from(PDF_BUCKET)
    .list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 1 });
  if (error) throw new Error(`Could not read upload: ${error.message}`);
  const file = data?.find((f) => f.name === path.slice(slash + 1));
  const size = (file?.metadata as { size?: number } | null | undefined)?.size;
  return typeof size === "number" ? size : null;
}

export async function downloadPdfBase64(path: string): Promise<string> {
  const { data, error } = await createAdminClient().storage.from(PDF_BUCKET).download(path);
  if (error || !data) throw new Error(`Could not download PDF: ${error?.message ?? "unknown"}`);
  return Buffer.from(await data.arrayBuffer()).toString("base64");
}

export async function removePdf(path: string): Promise<void> {
  const { error } = await createAdminClient().storage.from(PDF_BUCKET).remove([path]);
  if (error) throw new Error(`Could not remove PDF: ${error.message}`);
}

/** Short-lived signed download URL for an original PDF. Callers must have authorized the download first. */
export async function createPdfDownloadUrl(path: string, ttlSeconds: number, downloadName: string): Promise<string | null> {
  const { data, error } = await createAdminClient().storage.from(PDF_BUCKET).createSignedUrl(path, ttlSeconds, { download: downloadName });
  if (error || !data) {
    console.error("could not sign PDF download", error?.message);
    return null;
  }
  return data.signedUrl;
}
