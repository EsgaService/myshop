import type { AiBookProvider } from "@/lib/ai/types";
import { AiProviderError } from "@/lib/ai/types";
import { parseAiBook } from "./ai-book-schema";
import { toBookPayload, type BookPayload } from "./to-book-payload";

export type IngestionJob = { id: string; upload_id: string; attempts: number; max_attempts: number };

export type UploadRef = { id: string; sellerId: string; storagePath: string; originalName: string };

export type IngestionRepo = {
  getUpload(uploadId: string): Promise<UploadRef | null>;
  /** Atomic + idempotent (RPC create_book_from_ingestion). Also marks upload ready and job succeeded. */
  createBook(sellerId: string, uploadId: string, payload: BookPayload): Promise<string>;
  /** Puts the job back in the queue to run at `runAfter`. */
  markRetry(jobId: string, runAfter: Date, error: string): Promise<void>;
  /** Marks job and upload as failed. */
  markFailed(jobId: string, uploadId: string, error: string): Promise<void>;
};

export type ProcessJobDeps = {
  repo: IngestionRepo;
  storage: { downloadBase64(path: string): Promise<string> };
  ai: AiBookProvider;
  now: () => Date;
  signal?: AbortSignal;
};

export type ProcessJobResult =
  | { outcome: "succeeded"; bookId: string }
  | { outcome: "retry"; runAfter: Date }
  | { outcome: "failed"; error: string };

const GENERIC_ERROR = "No pudimos procesar el PDF. Inténtalo de nuevo con otro archivo.";
const MAX_ERROR_LENGTH = 500;

/** 30s per attempt already made (attempts is incremented when the job is claimed). */
export function retryDelayMs(attempts: number): number {
  return 30_000 * Math.max(1, attempts);
}

class PermanentError extends Error {}

function safeMessage(error: unknown): string {
  if (error instanceof AiProviderError || error instanceof PermanentError) return error.message.slice(0, MAX_ERROR_LENGTH);
  return GENERIC_ERROR;
}

/**
 * Runs one claimed job end to end. Never throws: every failure path ends in a
 * retry (attempts remaining) or a terminal failure, recorded through the repo.
 */
export async function processJob(job: IngestionJob, deps: ProcessJobDeps): Promise<ProcessJobResult> {
  try {
    const upload = await deps.repo.getUpload(job.upload_id);
    if (!upload) throw new PermanentError("El archivo ya no existe.");

    const pdfBase64 = await deps.storage.downloadBase64(upload.storagePath);
    const raw = await deps.ai.extractBook({ pdfBase64, fileName: upload.originalName, signal: deps.signal });

    const parsed = parseAiBook(raw);
    if (!parsed.ok) throw new AiProviderError(`La IA devolvió un recetario inválido: ${parsed.error}`);

    const bookId = await deps.repo.createBook(upload.sellerId, upload.id, toBookPayload(parsed.data));
    return { outcome: "succeeded", bookId };
  } catch (error) {
    const message = safeMessage(error);
    const permanent = error instanceof PermanentError || (error instanceof AiProviderError && !error.retryable);

    if (!permanent && job.attempts < job.max_attempts) {
      const runAfter = new Date(deps.now().getTime() + retryDelayMs(job.attempts));
      await deps.repo.markRetry(job.id, runAfter, message);
      return { outcome: "retry", runAfter };
    }
    await deps.repo.markFailed(job.id, job.upload_id, message);
    return { outcome: "failed", error: message };
  }
}
