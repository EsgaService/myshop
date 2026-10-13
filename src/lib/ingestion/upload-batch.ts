import { checkUpload } from "@/lib/books/upload-limit";
import { uploadErrorMessage, type RequestUploadResult } from "@/lib/books/request-upload-core";

export type UploadCandidate = { name: string; size: number; type: string };

export type FileOutcome =
  | { name: string; ok: true; uploadId: string }
  | { name: string; ok: false; message: string; needsPlan?: boolean };

type PreparedUpload = Extract<RequestUploadResult, { ok: true }>;

export type UploadBatchDeps<F extends UploadCandidate> = {
  /** Server pre-check: the whole batch must fit in the seller's remaining slots. */
  checkBatchCapacity(count: number): Promise<{ ok: true } | { ok: false; message: string }>;
  /** Creates the target product when needed (called only after the batch passed every pre-check). */
  resolveBookId(): Promise<{ ok: true; bookId: string } | { ok: false; message: string }>;
  requestUpload(input: { name: string; size: number; mime: string; bookId: string }): Promise<RequestUploadResult>;
  /** Pushes the file to the signed upload URL (browser side). */
  putFile(prepared: PreparedUpload, file: F): Promise<{ ok: true } | { ok: false }>;
  confirmUpload(uploadId: string): Promise<{ ok: true } | { ok: false; message: string; code?: "subscription_required" }>;
  /** Called before each file starts and after it settles, for progress UI. */
  onProgress?(index: number, phase: "uploading" | "done", outcome?: FileOutcome): void;
};

export type UploadBatchResult = { batchError?: string; outcomes: FileOutcome[] };

const PUT_FAILED =
  "No pudimos subir el archivo. Inténtalo de nuevo; si queda en la lista como incompleto, elimínalo.";
const UNEXPECTED = "Ocurrió un error inesperado. Inténtalo de nuevo.";

/**
 * Uploads several PDFs into one product. Every file is validated on its own, the batch cap is checked
 * once before anything is created or uploaded, and each file then runs request -> PUT -> confirm
 * sequentially so a failure only affects that file (R1.2, R1.4, R1.7).
 * Outcomes keep the selection order, which is also the upload order.
 */
export async function runUploadBatch<F extends UploadCandidate>(
  files: F[],
  deps: UploadBatchDeps<F>,
): Promise<UploadBatchResult> {
  const outcomes: (FileOutcome | null)[] = files.map(() => null);

  // 1. Per-file validation (UX only; the server re-validates).
  const valid: number[] = [];
  files.forEach((file, i) => {
    const check = checkUpload({ activeCount: 0, size: file.size, mime: file.type, name: file.name });
    if (check.ok) valid.push(i);
    else outcomes[i] = { name: file.name, ok: false, message: uploadErrorMessage(check.reason) };
  });
  const settled = () => outcomes.map((o, i) => o ?? { name: files[i]!.name, ok: false as const, message: UNEXPECTED });
  if (valid.length === 0) return { outcomes: settled() };

  // 2. Batch cap, then the target product.
  const capacity = await deps.checkBatchCapacity(valid.length);
  if (!capacity.ok) return { batchError: capacity.message, outcomes: [] };
  const target = await deps.resolveBookId();
  if (!target.ok) return { batchError: target.message, outcomes: [] };

  // 3. Sequential per-file pipeline.
  for (const i of valid) {
    const file = files[i]!;
    deps.onProgress?.(i, "uploading");
    outcomes[i] = await uploadOne(file, target.bookId, deps);
    deps.onProgress?.(i, "done", outcomes[i]!);
  }
  return { outcomes: settled() };
}

async function uploadOne<F extends UploadCandidate>(file: F, bookId: string, deps: UploadBatchDeps<F>): Promise<FileOutcome> {
  try {
    const prepared = await deps.requestUpload({ name: file.name, size: file.size, mime: file.type, bookId });
    if (!prepared.ok) {
      return { name: file.name, ok: false, message: prepared.message, needsPlan: prepared.reason === "subscription_required" };
    }
    const put = await deps.putFile(prepared, file);
    if (!put.ok) return { name: file.name, ok: false, message: PUT_FAILED };

    const confirmed = await deps.confirmUpload(prepared.uploadId);
    if (!confirmed.ok) {
      return { name: file.name, ok: false, message: confirmed.message, needsPlan: confirmed.code === "subscription_required" };
    }
    return { name: file.name, ok: true, uploadId: prepared.uploadId };
  } catch {
    return { name: file.name, ok: false, message: UNEXPECTED };
  }
}
