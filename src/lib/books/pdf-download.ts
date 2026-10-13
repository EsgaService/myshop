/** Pure helpers for the buyer PDF download feature (R3). Nothing here knows about storage paths. */

export const DOWNLOAD_URL_TTL_SECONDS = 60;

const MAX_FILE_NAME = 120;
const FALLBACK_NAME = "recetario.pdf";

/** API path of the download route for one PDF of one book. */
export function pdfDownloadPath(bookId: string, uploadId: string): string {
  return `/api/books/${bookId}/pdfs/${uploadId}`;
}

/**
 * Name the browser saves the file as. The seller's original name is untrusted input that ends up in a
 * Content-Disposition header, so path parts, quotes and control characters are removed.
 */
export function downloadFileName(original: string): string {
  const base = (original.split(/[\\/]/).pop() ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"]/g, "")
    .trim();
  const stem = base.replace(/\.pdf$/i, "").trim();
  if (!stem || /^\.+$/.test(stem)) return FALLBACK_NAME;
  const ext = /\.pdf$/i.test(base) ? base.slice(-4) : ".pdf";
  return stem.slice(0, MAX_FILE_NAME - ext.length) + ext;
}

/** Human size in Spanish number format: "512 KB", "1,5 MB". */
export function formatFileSize(bytes: number): string {
  const safe = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (safe < 1024 * 1024) return `${Math.round(safe / 1024)} KB`;
  const mb = Math.round((safe / (1024 * 1024)) * 10) / 10;
  return `${String(mb).replace(".", ",")} MB`;
}

export type BookPdf = { id: string; name: string; sizeBytes: number };

/** Maps upload rows to the public listing shape: id, name and size only (the storage path never leaves the server). */
export function toBookPdfs(rows: { id: string; original_name: string; size_bytes: number }[]): BookPdf[] {
  return rows.map((row) => ({ id: row.id, name: row.original_name, sizeBytes: row.size_bytes }));
}
