import { assignPhotos } from "./assign-photos";
import { chooseCover } from "./choose-cover";
import { decideExtractionWrite } from "./decide-extraction-write";
import { filterImages } from "./filter-images";
import { matchRecipesToPages } from "./match-recipes";
import type { CandidateRow, ImageEncoder, ImageStore, PdfImageExtractor, UploadToProcess } from "./ports";
import type { Placement } from "./types";

/** Candidates persisted per upload (R1.4): enough for the picker, bounded for storage. */
export const MAX_CANDIDATES_PER_UPLOAD = 150;
const MAX_PAGES = 300;

export type ExtractionResult = { status: "done"; stored: number } | { status: "failed"; error: string };

export type ExtractDeps = {
  extractor: PdfImageExtractor;
  encoder: ImageEncoder;
  store: ImageStore;
  signal: AbortSignal;
};

const area = (p: Placement) => p.bbox.w * p.bbox.h;
const byPosition = (a: Placement, b: Placement) => a.page - b.page || a.opIndex - b.opIndex;
const placementId = (p: Placement) => `${p.page}:${p.opIndex}`;

/**
 * Extracts, stores and links the images of one READY upload (R1.1). Zero AI, idempotent (same PDF, same
 * ordinals and paths) and best-effort: any error is recorded on the upload and returned, never thrown, and
 * the store has no way to touch the book or the upload status (R1.2). Only `auto` recipes and covers are
 * linked, so seller choices survive a re-extraction (R3.4).
 */
export async function extractUploadImages(upload: UploadToProcess, deps: ExtractDeps): Promise<ExtractionResult> {
  const { extractor, encoder, store, signal } = deps;
  let scan: Awaited<ReturnType<PdfImageExtractor["scan"]>> | null = null;
  try {
    signal.throwIfAborted();
    const pdf = await store.downloadPdf(upload.storagePath);
    scan = await extractor.scan(pdf, { signal, maxPages: MAX_PAGES });

    const recipes = await store.listUploadRecipes(upload.id);
    const { kept } = filterImages(scan.placements);
    const matches = matchRecipesToPages(
      recipes.map((r) => ({ id: r.id, title: r.title })),
      scan.pages,
      scan.pageCount,
    );
    const assignments = assignPhotos(matches, kept);
    const book = await store.getBookCover(upload.bookId);
    const coverPick = chooseCover({ currentCoverUrl: book.coverUrl, coverSource: book.coverSource, candidates: kept });

    // Keep what is linked to a recipe or the cover first, then the biggest, up to the cap.
    const priority = new Set([...assignments.map((a) => placementId(a.placement)), ...(coverPick ? [placementId(coverPick)] : [])]);
    const selected = [...kept]
      .sort((a, b) => Number(priority.has(placementId(b))) - Number(priority.has(placementId(a))) || area(b) - area(a) || byPosition(a, b))
      .slice(0, MAX_CANDIDATES_PER_UPLOAD)
      .sort(byPosition);

    const rows: CandidateRow[] = [];
    const storedPathById = new Map<string, string>();
    for (const [index, placement] of selected.entries()) {
      signal.throwIfAborted();
      const pixels = await scan.decode(placement);
      if (!pixels) continue; // undecodable (JPX/CMYK failure): skipped
      const encoded = await encoder.toWebp(pixels);
      const ordinal = index + 1;
      const base = `${upload.sellerId}/${upload.id}/${ordinal}`;
      await store.putImage(`${base}.webp`, encoded.full);
      await store.putImage(`${base}-t.webp`, encoded.thumb);
      const pageArea = placement.pageSize.width * placement.pageSize.height;
      rows.push({
        ordinal,
        page: placement.page,
        width: encoded.width,
        height: encoded.height,
        areaRatio: pageArea > 0 ? area(placement) / pageArea : 0,
        imageKey: placement.key,
        storagePath: `${base}.webp`,
        thumbPath: `${base}-t.webp`,
      });
      storedPathById.set(placementId(placement), `${base}.webp`);
    }

    // The seller may have removed or moved the PDF while it was processed: re-read before every write phase.
    const canWrite = async () =>
      decideExtractionWrite({ startedBookId: upload.bookId, current: await store.getUploadState(upload.id) }) === "write";
    if (!(await canWrite())) return { status: "done", stored: 0 };

    await store.replaceCandidates(upload, rows);

    if (!(await canWrite())) return { status: "done", stored: 0 };

    const autoRecipes = new Set(recipes.filter((r) => r.photoSource === "auto").map((r) => r.id));
    const photoByRecipe = new Map(assignments.map((a) => [a.recipeId, storedPathById.get(placementId(a.placement))]));
    const updates = matches
      .filter((m) => m.titlePage !== null && autoRecipes.has(m.recipeId))
      .map((m) => {
        const photoPath = photoByRecipe.get(m.recipeId);
        return photoPath
          ? { recipeId: m.recipeId, sourcePage: m.titlePage as number, photoPath }
          : { recipeId: m.recipeId, sourcePage: m.titlePage as number };
      });
    if (updates.length > 0) await store.setRecipePhotos(updates);

    const coverPath = coverPick ? storedPathById.get(placementId(coverPick)) : undefined;
    if (coverPath) await store.setCover(upload.bookId, coverPath, upload.id);

    await store.markDone(upload.id, rows.length > 0);
    return { status: "done", stored: rows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await store.markFailed(upload.id, message);
    } catch (markError) {
      console.error("could not record image extraction failure", markError);
    }
    return { status: "failed", error: message };
  } finally {
    await scan?.close().catch((e) => console.error("could not close PDF scan", e));
  }
}
