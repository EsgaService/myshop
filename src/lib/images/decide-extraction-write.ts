/** What the extraction knew about the upload when it started, and what the database says right before writing. */
export type ExtractionWriteInput = {
  startedBookId: string;
  /** Fresh read of the upload, or null when it no longer exists. */
  current: { bookId: string | null; removedAt: string | null } | null;
};

/**
 * Extraction runs for a long time while the seller may remove the PDF or move it to another product. Writing
 * candidates or links after that would resurrect rows of a removed upload or attach photos to the wrong product.
 */
export function decideExtractionWrite(input: ExtractionWriteInput): "write" | "skip" {
  const { current, startedBookId } = input;
  if (!current) return "skip";
  if (current.removedAt) return "skip";
  if (current.bookId !== startedBookId) return "skip";
  return "write";
}
