import sharp from "sharp";
import type { RawImage } from "./ports";

/** Longest side of the decoded pixels; the shared encoder caps images at this size anyway. */
export const MAX_DECODED_SIDE = 1600;
/** Largest source accepted (input pixels), so a decompression bomb is rejected before it allocates. */
export const MAX_INPUT_PIXELS = 40_000_000;

/**
 * Decodes a validated seller image (PNG/JPEG/WebP) to raw pixels, applying the EXIF orientation and shrinking it inside the same pipeline (never a full-size raw buffer). The shared
 * `ImageEncoder` then re-encodes them, which drops metadata and any payload hidden in the original bytes.
 * Throws when the bytes are not a decodable image.
 */
export async function decodeCustomImage(input: Uint8Array): Promise<RawImage> {
  const source = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize(MAX_DECODED_SIDE, MAX_DECODED_SIDE, { fit: "inside", withoutEnlargement: true });
  const { hasAlpha } = await source.metadata();
  const pipeline = hasAlpha ? source.ensureAlpha() : source.removeAlpha();
  const { data, info } = await pipeline.toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    channels: info.channels as 3 | 4,
    data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
  };
}
