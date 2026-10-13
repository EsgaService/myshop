import { pdfPath } from "@/lib/ingestion/pdf-path";
import { checkUpload } from "./upload-limit";

export type UploadFailureReason = "subscription_required" | "limit_reached" | "not_pdf" | "empty" | "too_large" | "product_not_found" | "failed";

export type UploadDeps = {
  sellerId: string;
  newId(): string;
  /** Processing PDFs costs AI money: only sellers with an active subscription may upload. */
  hasActiveSubscription(): Promise<boolean>;
  /** Whether the product exists, belongs to the seller and is not archived. */
  isBookUsable(bookId: string): Promise<boolean>;
  /** Active (not removed) uploads of the seller. */
  countActive(): Promise<number>;
  /** `limit: true` means the DB trigger rejected the row (race-safe 12 limit). */
  insertUpload(row: {
    id: string;
    seller_id: string;
    storage_path: string;
    original_name: string;
    size_bytes: number;
    book_id: string;
  }): Promise<{ ok: true } | { ok: false; limit: boolean }>;
  createSignedUrl(path: string): Promise<{ signedUrl: string; token: string }>;
};

export type RequestUploadResult =
  | { ok: true; uploadId: string; path: string; signedUrl: string; token: string; activeCount: number }
  | { ok: false; reason: UploadFailureReason; message: string };

const MAX_NAME = 200;

function safeName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  if (base.length <= MAX_NAME) return base;
  return base.slice(0, MAX_NAME - 4) + ".pdf";
}

export function uploadErrorMessage(reason: UploadFailureReason): string {
  switch (reason) {
    case "subscription_required":
      return "Necesitas una suscripción activa para subir PDF.";
    case "limit_reached":
      return "Llegaste al máximo de 12 PDF. Elimina uno que haya fallado para subir otro.";
    case "not_pdf":
      return "Solo puedes subir archivos PDF.";
    case "empty":
      return "El archivo está vacío.";
    case "too_large":
      return "El PDF supera el tamaño máximo de 20 MB.";
    case "product_not_found":
      return "No encontramos ese producto en tu tienda.";
    case "failed":
      return "No pudimos preparar la subida. Inténtalo de nuevo.";
  }
}

const fail = (reason: UploadFailureReason): RequestUploadResult => ({ ok: false, reason, message: uploadErrorMessage(reason) });

/**
 * Validates an upload request, records the row (the DB trigger is the race-safe
 * backstop for the 12 limit) and only then issues a signed upload URL, so a
 * rejected request never leaves anything in storage.
 */
export async function requestUploadCore(
  input: { name: string; size: number; mime: string; bookId: string },
  deps: UploadDeps,
): Promise<RequestUploadResult> {
  if (!(await deps.hasActiveSubscription())) return fail("subscription_required");

  if (!(await deps.isBookUsable(input.bookId))) return fail("product_not_found");

  const activeCount = await deps.countActive();
  const check = checkUpload({ activeCount, size: input.size, mime: input.mime, name: input.name });
  if (!check.ok) return fail(check.reason);

  const uploadId = deps.newId();
  const path = pdfPath(deps.sellerId, uploadId);
  const inserted = await deps.insertUpload({
    id: uploadId,
    seller_id: deps.sellerId,
    storage_path: path,
    original_name: safeName(input.name),
    size_bytes: input.size,
    book_id: input.bookId,
  });
  if (!inserted.ok) return fail(inserted.limit ? "limit_reached" : "failed");

  try {
    const { signedUrl, token } = await deps.createSignedUrl(path);
    return { ok: true, uploadId, path, signedUrl, token, activeCount: activeCount + 1 };
  } catch {
    return fail("failed");
  }
}
