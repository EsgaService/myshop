import "server-only";
import { extractUploadImages } from "./extract-upload-images";
import { claimNextImageUpload, createImageStore } from "./image-store";
import { pdfjsExtractor } from "./pdfjs-extractor";
import { sharpEncoder } from "./sharp-encoder";
import { sweepImageExtraction, type SweepSummary } from "./sweep";

/**
 * Wires the image sweep with the real adapters. Call it after the ingestion queue is drained with the time
 * left on the request. It never throws: image problems must not affect ingestion (R1.2), and an unapplied
 * migration (missing RPC) just logs.
 */
export async function runImageSweep(remainingMs: number): Promise<SweepSummary | null> {
  try {
    const store = createImageStore();
    return await sweepImageExtraction(
      {
        claim: claimNextImageUpload,
        run: (upload, timeoutMs) =>
          extractUploadImages(upload, {
            extractor: pdfjsExtractor,
            encoder: sharpEncoder,
            store,
            signal: AbortSignal.timeout(timeoutMs),
          }),
        now: () => Date.now(),
      },
      { remainingMs },
    );
  } catch (error) {
    console.error("image sweep failed", error);
    return null;
  }
}
