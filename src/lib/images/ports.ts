import type { CoverSource } from "./choose-cover";
import type { PageText, Placement } from "./types";

/** Decoded pixels. 1 = gray, 3 = RGB, 4 = RGBA (8 bits per channel). */
export type RawImage = { width: number; height: number; channels: 1 | 3 | 4; data: Uint8Array | Uint8ClampedArray };

export interface PdfScan {
  pageCount: number;
  pages: PageText[];
  placements: Placement[];
  /** Decodes one placement, or null when the image cannot be decoded (it is then skipped). */
  decode(placement: Placement): Promise<RawImage | null>;
  close(): Promise<void>;
}

export interface PdfImageExtractor {
  scan(pdf: Uint8Array, opts: { signal: AbortSignal; maxPages: number }): Promise<PdfScan>;
}

export interface ImageEncoder {
  toWebp(input: RawImage): Promise<{ full: Uint8Array; thumb: Uint8Array; width: number; height: number }>;
}

export type PhotoSource = "auto" | "pdf" | "custom" | "none";

export type UploadToProcess = { id: string; sellerId: string; bookId: string; storagePath: string };

export type UploadRecipe = { id: string; title: string; photoSource: PhotoSource };

export type CandidateRow = {
  ordinal: number;
  page: number;
  width: number;
  height: number;
  areaRatio: number;
  imageKey: string;
  storagePath: string;
  thumbPath: string;
};

/**
 * Persistence used by the extraction. By construction it cannot change `books.status`, `book_uploads.status`
 * or the ingestion job: image problems never fail the book (R1.2).
 */
export interface ImageStore {
  downloadPdf(storagePath: string): Promise<Uint8Array>;
  /** Recipes created from this upload, in PDF order. */
  listUploadRecipes(uploadId: string): Promise<UploadRecipe[]>;
  getBookCover(bookId: string): Promise<{ coverUrl: string | null; coverSource: CoverSource }>;
  /** Fresh read of the upload (null when gone), used to abort writes after a removal or a move. */
  getUploadState(uploadId: string): Promise<{ bookId: string | null; removedAt: string | null } | null>;
  /** Uploads (upserts) a WebP object into the recipe-photos bucket. */
  putImage(path: string, bytes: Uint8Array): Promise<void>;
  /** Upserts the rows by (upload, ordinal) and deletes the upload's rows whose ordinal is not listed. */
  replaceCandidates(upload: UploadToProcess, rows: CandidateRow[]): Promise<void>;
  /** Applied only to recipes whose photo_source is still 'auto'. A missing photoPath leaves the photo alone. */
  setRecipePhotos(updates: { recipeId: string; sourcePage: number; photoPath?: string }[]): Promise<void>;
  /** Applied only when the book still has no cover, cover_source is 'auto' and the upload is still active in that book. */
  setCover(bookId: string, path: string, uploadId: string): Promise<void>;
  markDone(uploadId: string, reviewPending: boolean): Promise<void>;
  markFailed(uploadId: string, message: string): Promise<void>;
}
