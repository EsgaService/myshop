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

export type BatchCheck =
  | { ok: true }
  | { ok: false; reason: "limit_reached"; remaining: number }
  | { ok: false; reason: "empty_batch" };

/**
 * Cap pre-check for a multi-file upload (R1.4): the whole batch is rejected before any file is
 * uploaded when it does not fit in the seller's remaining slots. `slotsHeld` is the count of
 * uploads that hold a slot (see `holdsUploadSlot`).
 */
export function decideBatchUpload(input: { slotsHeld: number; requested: number }): BatchCheck {
  if (input.requested < 1) return { ok: false, reason: "empty_batch" };
  const remaining = Math.max(0, MAX_UPLOADS_PER_SELLER - input.slotsHeld);
  if (input.requested > remaining) return { ok: false, reason: "limit_reached", remaining };
  return { ok: true };
}

export function batchLimitMessage(remaining: number): string {
  if (remaining <= 0) return `Llegaste al máximo de ${MAX_UPLOADS_PER_SELLER} PDF. Elimina alguno para subir otro.`;
  return `Solo puedes subir ${remaining} PDF más (máximo ${MAX_UPLOADS_PER_SELLER}). Elige menos archivos o elimina alguno.`;
}

/** Supabase signed upload URLs stay valid for 2 hours. */
export const UPLOAD_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * Whether an upload row counts toward the 12 limit. Removing a PENDING upload must not free its
 * slot while the signed upload token can still be used (the browser could still push a file).
 * Mirrored by the `enforce_upload_limit` trigger.
 */
export function holdsUploadSlot(row: { status: string; removed_at: string | null }, now: Date): boolean {
  if (row.removed_at === null) return true;
  if (row.status !== "pending") return false;
  return now.getTime() - new Date(row.removed_at).getTime() < UPLOAD_TOKEN_TTL_MS;
}
