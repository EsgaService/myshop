/** JSON returned by the owner-only job status endpoint (polled by the seller panel). */
export function buildJobStatusBody(
  job: { id: string; status: string; attempts: number; max_attempts: number; last_error: string | null },
  upload: { status: string; book_id: string | null },
) {
  return {
    id: job.id,
    status: job.status,
    uploadStatus: upload.status,
    attempts: job.attempts,
    maxAttempts: job.max_attempts,
    error: job.status === "failed" ? job.last_error : null,
    /** The product (`books.id`) the PDF belongs to. It is set at request time, so it does NOT mean "ingested". */
    bookId: upload.book_id,
    /** Content was merged into the product: `book_uploads.status = 'ready'`. */
    ingested: upload.status === "ready",
  };
}
