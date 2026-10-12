export const MAX_UPLOADS_PER_SELLER = 12;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

export type UploadCheck =
  | { ok: true }
  | { ok: false; reason: "limit_reached" | "not_pdf" | "empty" | "too_large" };

/**
 * App-level upload gate. The database trigger `enforce_upload_limit` is the
 * race-safe backstop for the same 12-upload limit.
 */
export function checkUpload(input: { activeCount: number; size: number; mime: string; name: string }): UploadCheck {
  if (input.activeCount >= MAX_UPLOADS_PER_SELLER) return { ok: false, reason: "limit_reached" };
  if (input.mime !== "application/pdf" || !/\.pdf$/i.test(input.name)) return { ok: false, reason: "not_pdf" };
  if (!Number.isFinite(input.size) || input.size <= 0) return { ok: false, reason: "empty" };
  if (input.size > MAX_PDF_BYTES) return { ok: false, reason: "too_large" };
  return { ok: true };
}
